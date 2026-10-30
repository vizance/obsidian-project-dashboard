## Context

外掛目前有兩種設定：

- 建置時讀的個人規則：`src/core/personal-rules.local.ts`（git 忽略），內含專案資料夾、手動分類片段、分類關鍵字、不列入的專案。建置時打包進 `main.js`，公開 release 用的是範例值。
- 執行時的外掛資料：Obsidian 的 `loadData`／`saveData`，目前只有 `categoryOverrides`（在儀表板上手動指定的分類）。

日期規則寫死在程式裡：

- 排程日期是「那週星期一加 4 天」，常數在 `src/core/task-lines.ts`。
- 週六算下一週的規則有兩份：`src/core/weeks.ts` 的 `taskDateToWeekLabel`，以及 `src/core/scan.ts` 的 `computeOccupiedWeeks`。

edit-tasks-in-week-popover 的設計當時就記下：之後開放設定時，兩條規則要一起開放，週六規則也要收斂成一份。維護者的 vault 有開 Obsidian Sync，外掛資料會同步到其他裝置。

## Goals / Non-Goals

**Goals:**

- 從 release 安裝的人，不改程式就能設定專案資料夾、分類規則、不列入的專案、排程星期幾、週六規則。
- 設定的讀取、檢查與預設值集中在一個純函式模組，之後月視圖與行事曆列加欄位時只改這裡和設定頁。
- 兩條日期規則一起開放，任何組合下，排進某週的任務都顯示在那一週。
- 維護者現有的規則搬過去後，儀表板顯示與搬家前完全相同。

**Non-Goals:**

- 月視圖、行事曆列、番茄鐘（之後的 change）。
- 自訂分類本身（七個分類的名稱與顏色維持寫在 `src/core/config.ts`）。
- 在設定頁列出或新增「精確名稱覆寫」；這仍在儀表板的 `編輯分類` 裡處理。
- 換週的 7 天步距開放設定。
- 設定的匯入匯出、多組設定檔。

## Decisions

### 設定集中在一個純函式模組

新增 `src/core/settings.ts`（不 import obsidian）：設定型別、預設值、預設分類規則、`normalizePluginData`。外掛資料長相是 `{ categoryOverrides, settings }`。每個欄位各自檢查，無效就換成該欄位的預設值，所以一個欄位壞掉不會讓其他設定一起消失。

替代方案是 Obsidian 範例常見的 `Object.assign({}, DEFAULT_SETTINGS, await loadData())`。它不檢查型別，陣列還會和預設值共用同一份參照，被改到時預設值也跟著變，所以不採用。

### 分類規則合併成一份有順序的清單

現在的「手動分類片段」和「分類關鍵字」都是「名稱包含某段文字就歸到某分類」，差別只在誰先比對。設定頁合成一份有順序的清單，由上往下第一個符合的生效。搬家時手動片段排在前、關鍵字在後，順序與原本一致，分類結果不變。

維持兩份清單會讓使用者在設定頁看到兩個長得一樣的表格，還得記住哪個優先，所以不採用。

文字是空白的規則照樣存著，分類時跳過。設定頁的每一列和存起來的清單永遠一對一，上移、下移、刪除用的位置才對得上；剛按「新增分類規則」、還沒打字的那一列，存檔後也不會消失。

### 精確名稱覆寫留在儀表板

`categoryOverrides` 的新增與清除，繼續由儀表板的 `編輯分類` 處理，設定頁不另外列出。儀表板的下拉選單已經能清除（`自動（清除覆寫）`），在設定頁再做一份是重複功能。

### 週對應與排程日期：一個函式、明確傳入規則

- 新增 `weekOfTaskDate(date, rules)`，取代 `taskDateToWeekLabel` 與 `computeOccupiedWeeks` 裡的週六判斷，掃描、年視圖格子、提示文字、浮窗都呼叫它。
- `scheduleDateForWeek(weekLabel, rules)`：那週星期一加 `scheduleWeekday − 1` 天；選星期六且週六規則開啟時，改寫前一個週六（星期一減 2 天）。

這樣不論設定怎麼組合，排進某週的任務一定顯示在那一週。維護者習慣把週六的日期當成「下週要做」的標記，這條規則讓他在設定裡選星期六時仍然成立。

替代方案是週六規則開啟時，在下拉選單停用星期六。這會擋掉維護者實際在用的寫法，所以不採用。

### 規則用參數傳進純函式，不用全域設定

`scanProjectFolder`、`classify`、`perWeekCells`／`timelineCells`、`taskLinesForWeek`、`scheduleDateForWeek` 都改成接收設定（或其中的日期規則）當參數。浮窗透過 host 拿目前的設定。

替代方案是做一個全域可變的設定物件，由外掛啟動時寫入。那會讓函式依賴隱藏狀態，測試也要注意執行順序，所以不採用。

### 外掛資料一次寫整份

外掛提供單一的存檔方法，永遠寫整份 `{ categoryOverrides, settings }`。儀表板存手動分類時也走這個方法。目前存分類的程式只寫 `{ categoryOverrides }`，加了設定以後會把設定蓋掉，這個決定同時修掉這個問題。

### 外掛資料由一個不依賴 Obsidian 的元件管理

新增 `src/core/plugin-data-store.ts` 的 `PluginDataStore`，建構時注入「讀外掛資料」「寫外掛資料」兩個函式和計時器（沿用 `createDebouncer` 的注入方式）。它負責：

- 載入時檢查資料。
- 每次寫入都寫整份。
- 設定修改延後 400 ms 合併成一次存檔。
- 存檔失敗時還原成上次存成功的值並回報。
- 外部變更時取消還沒存的修改，重新讀取。
- 通知訂閱者。

`src/main.ts` 只負責把 Obsidian 的 `loadData`／`saveData`／`onExternalSettingsChange` 接到這個元件。存手動分類則立即寫入，維持現在的提示與失敗處理。

替代方案是把這些邏輯直接寫在 `Plugin` 子類別裡。那樣測試得模擬整個 Obsidian 外掛環境，而 `tests/stubs/obsidian.ts` 目前只模擬 vault，所以不採用。

### 設定變更的流向

```
設定頁（400 ms 內的連續修改合併成一次）
   │ updateSettings(next)
   ▼
外掛：存整份外掛資料 ──失敗──▶ 提示「Your settings couldn't be saved. Please try again.」，還原成上次存成功的值，重畫設定頁
   │ 成功
   ▼
通知每個開著的儀表板分頁 ──▶ 重新掃描（資料夾、分類、週六規則都用新值）並重繪

Obsidian Sync 帶來外部變更 ──▶ onExternalSettingsChange ──▶ 取消還沒存的修改 ──▶ 重新讀取、檢查 ──▶ 通知儀表板；設定頁開著就重畫

以上存檔、延後、還原、取消都在 PluginDataStore 裡；設定頁與 main.ts 只呼叫它。
```

`VaultSource` 每次掃描、每次判斷檔案事件時，都從 getter 讀當下的專案資料夾，不在建構時固定。

### 設定頁的做法

- 使用 `PluginSettingTab` 與 `Setting`，三個區塊用 `setHeading()`。文字用國小五年級學生讀得懂的淺白英文，所有字串照 dashboard-settings 規格。
- 分類規則每一列有文字欄、分類下拉選單，以及 `Move up`、`Move down`、`Delete` 三個圖示按鈕（`arrow-up`、`arrow-down`、`trash`，文字放在 tooltip 與 aria-label）。新增、刪除、移動後整頁重畫。
- 專案資料夾欄位在找不到資料夾時，下方顯示 `Can't find this folder.`。
- 文字欄位邊打字邊更新記憶體中的設定。存檔和重新掃描統一延後到最後一次修改後 400 ms，下拉選單與開關也一樣，所以一連串修改只會存一次、掃描一次。
- 送進元件的值一律先經過同一套檢查。例如專案資料夾清空時，掃描和存檔都用 `Projects`，「找不到這個資料夾」的提示也用檢查後的值判斷。
- 星期幾下拉選單的選項值是 `"1"` 到 `"7"`，存進設定前轉成整數，避免文字 `"6"` 被檢查規則當成無效而退回星期五。

### 設定頁用淺白英文

設定頁原本規劃用繁體中文。朱騏手動驗收時決定改成國小五年級學生讀得懂的英文：設定頁和外掛名稱、指令名稱一樣屬於外掛層級，用英文；公開安裝的人也看得懂。寫法限制是短句、常用字、不用術語。

界線如下：

- 儀表板本身（年視圖、週浮窗、提示與 toast）維持繁體中文。
- 分類下拉選單顯示的是儀表板上同一組中文分類標籤，兩邊才對得起來。
- 分類規則的文字是使用者的資料，照存起來的內容顯示，不翻譯。

替代方案是設定頁中英並列。字數會加倍，國小五年級的讀者反而更難掃讀，所以不採用。

### 移除建置時的個人規則

刪除 `src/core/personal-rules.example.ts`、`scripts/ensure-local-rules.mjs`、`package.json` 的 `postinstall`／`prebuild`／`pretest`／`prelint`／`predeploy`、`vitest.config.ts` 的別名、`eslint.config.mjs` 的對應項目，`src/core/config.ts` 只留分類定義。這樣 release 的 `main.js` 不再因為在哪台電腦建置而內容不同。不過「release 一律從乾淨副本建置」的規則照舊。

### 維護者的設定一次搬家

搬家只做一次，不寫進 repo：

1. 先把 vault 內本外掛目前的資料檔複製一份到 repo 之外的備份資料夾。
2. 用暫存腳本讀維護者本機的 `personal-rules.local.ts`，組成 `settings`：
   - 專案資料夾。
   - 分類規則：手動片段依原本順序在前，關鍵字在後。
   - 不列入的專案。
   - `scheduleWeekday` 5、`saturdayCountsAsNextWeek` true，保持現在的行為。
3. 在外掛停用時寫進 vault 內本外掛的資料檔，保留原本的 `categoryOverrides`。
4. 只寫外掛自己的資料檔，不碰任何筆記。

搬完用新舊兩版程式掃描同一批真實筆記，逐欄比對，差異必須為 0；確認後才把本機的 `personal-rules.local.ts` 移到垃圾桶。

### 版本

設定頁是新功能，版本升為 0.3.0。CHANGELOG 要特別寫明：週六規則改成預設關閉，原本依賴這條規則的人，要到設定頁打開。

## Implementation Contract

**行為：**

- **設定頁**：Settings → Project Dashboard 出現設定頁，三個區塊與所有文字照 dashboard-settings 規格。
- **修改即生效**：任何修改在最後一次修改後 400 ms 存檔，開著的儀表板分頁不用重開就重新掃描、重繪。
- **其他裝置同步**：同步過來的設定變更會重新載入並重繪。
- **專案資料夾**：改了資料夾以後，掃描和「哪些檔案變動要重掃」都用新資料夾。
- **分類順序**：精確名稱覆寫 → 分類規則清單由上往下第一個符合 → `other`。
- **週六規則**：開啟時週六日期算下一週（年視圖格子、提示、浮窗都一致）；關閉時算當週，提示和浮窗不出現週六標記。
- **排程日期**：照 dashboard-task-editing 的表格推算；新增任務沿用同一個日期。
- **存手動分類**：不會改動設定；存設定也不會改動手動分類。
- **同步優先**：其他裝置同步過來的外部變更，蓋過本機還沒存的修改，被蓋掉的修改之後也不會再寫回去。
- **空白規則**：文字是空白的分類規則照樣存著、顯示在設定頁，但不參與分類。

**介面與資料形狀：**

- `PluginData = { categoryOverrides: Record<string, string>; settings: DashboardSettings }`
- `PluginDataStore`：建構時注入 `load(): Promise<unknown>`、`save(data: PluginData): Promise<void>`、計時器。提供 `init()`、目前的資料、`updateSettings(next)`（延後 400 ms 存檔）、`saveCategoryOverrides(next)`（立即存檔，失敗時拋錯）、`reloadFromOutside()`（取消還沒存的修改後重新讀取）、`subscribe(listener)`。設定存檔失敗時還原成上次存成功的值，並呼叫注入的錯誤回報。
- `DashboardSettings = { projectFolder: string; classificationRules: { text: string; category: string }[]; excludedProjects: string[]; scheduleWeekday: number; saturdayCountsAsNextWeek: boolean }`，`scheduleWeekday` 是 1（星期一）到 7（星期日）的整數。
- `normalizePluginData(raw: unknown): PluginData`，依規格逐欄檢查，回傳新物件，不和預設值共用陣列。
- `weekOfTaskDate(date, rules)` 回傳 `{ label, isBumpedSat }`，日期無效時回傳 `null`；`scheduleDateForWeek(weekLabel, rules)` 回傳 `YYYY-MM-DD`。
- `classify(name, overrides, rules)`；掃描的 context 帶入整份設定。

**失敗與錯誤處理：**

- 外掛資料無效：逐欄換成預設值，不拋錯。
- 存設定失敗：顯示 Notice `Your settings couldn't be saved. Please try again.`，記憶體中的設定還原成上次存成功的值，重畫設定頁。
- 專案資料夾不存在：設定頁顯示 `Can't find this folder.`，儀表板顯示既有的 `找不到專案資料夾：<folder>`。
- 存手動分類失敗：維持既有行為。

**驗收標準：**

- 測試：規格裡每一個範例表格，每一列都有對應的測試。
- 乾淨副本：`npm ci`、`npm test`、`npm run lint`、`npm run build` 全部通過，且 `src/` 沒有多出任何檔案。
- 搬家：新舊兩版程式對維護者 vault 的掃描結果、各週浮窗列出的任務、排程日期完全相同。
- 手動驗收：朱騏在 Obsidian 逐項確認設定頁與儀表板的行為。

**範圍內：**

- 設定資料模型、設定頁、外掛接線。
- 純函式改成接收設定，週六規則收斂成一份。
- 移除建置時規則、搬家，以及文件與版本。

**範圍外：** Non-Goals 列出的所有項目。另外，年視圖表頭月份的分法（週一或週四）留給月視圖那個 change。

## Risks / Trade-offs

- [設定頁打字時一直重新掃描，造成卡頓] → 存檔和掃描統一延後到最後一次修改後 400 ms。
- [搬家時外掛還在執行，之後存檔把搬好的設定蓋掉] → 搬家前先停用外掛，寫完再啟用；`onExternalSettingsChange` 也會在偵測到外部變更時重新讀取。
- [兩台裝置同時改設定，同步時互相蓋掉] → 接受 Obsidian Sync 以最後寫入為準；設定很少改，發生機率低。
- [0.2.0 的使用者依賴週六規則，升級後顯示改變] → CHANGELOG 寫明預設關閉，以及到設定頁開啟的方法；維護者的值會在搬家時設成開啟。
- [移除建置時規則後，維護者本機的規則檔被誤刪而失去備份] → 只有在新舊比對差異為 0 後才移動，而且是移到垃圾桶，仍可還原。
- [任何一台還在跑 0.2.0 的電腦存手動分類，會寫入只有 `categoryOverrides` 的資料，把設定整段刪掉，再經 Obsidian Sync 傳回所有裝置] → 搬家前先備份資料檔；在所有會同步這個 vault 的電腦上更新到 0.3.0，或先停用外掛，之後才重新啟用（外掛只在桌面版執行）。

## Migration Plan

1. 實作與測試完成後，用乾淨副本確認建置不依賴本機檔案。
2. 把 vault 內本外掛目前的資料檔複製到 repo 之外的備份資料夾。
3. 部署新版 `main.js` 到維護者 vault 前，先在 Obsidian 停用本外掛；若有其他電腦也同步這個 vault，先在那些電腦停用本外掛，或確認它們已經拿到 0.3.0。
4. 執行暫存搬家腳本，寫入設定，保留 `categoryOverrides`。
5. 部署新版，重新啟用外掛，在設定頁確認數值。
6. 執行新舊比對，差異為 0 後，把 `personal-rules.local.ts` 移到垃圾桶。

回退方式：重新安裝 0.2.0 的 release 檔案。0.2.0 讀的時候會忽略 `settings`，但它存手動分類時只寫 `categoryOverrides`，第一次存檔就會刪掉整段設定。所以回退後要再升級時，用第 2 步的備份還原資料檔。需要原本的個人規則時，從垃圾桶還原 `personal-rules.local.ts`，在本機重新建置 0.2.0。

## Open Questions

（無）
