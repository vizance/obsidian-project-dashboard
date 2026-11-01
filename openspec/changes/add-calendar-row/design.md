## Context

月視圖（0.4.0）已經把專案筆記的任務放進「一個月 4～5 週」的表格，取代了朱騏月平行互見表的專案部分。表格最上面的 General 列，目前仍要每週從 Google 或 Apple 行事曆手抄。

已討論定案的做法：

- 讀行事曆的私密 iCal 網址，只讀不寫，不做帳號登入。
- 所有行程放進 General 一列。
- 只在打開儀表板或按重新整理時讀取。

外掛目前完全不連網。設定存在外掛資料（`settings`），由 `PluginDataStore` 集中正規化與存檔。月視圖由 `src/month-view.ts` 畫表格，`src/view.ts` 管浮窗與重繪。外掛的 `minAppVersion` 是 1.11.7，所以 Obsidian 1.11.4 新增的 `SecretStorage` 與 `SecretComponent` 可以直接用。

## Goals / Non-Goals

**Goals:**

- 月視圖最上面的 General 列，自動列出每週的行事曆行程，包含展開後的重複行程。
- 行事曆的私密連結不進外掛資料，因此不會跟著 Obsidian Sync 以明文同步，也不會出現在任何畫面文字裡。
- 讀不到行事曆時，說清楚是哪一個行事曆、什麼原因，而且不影響專案部分。
- 公開外掛的連網與第三方授權說明符合 Obsidian 規定與 MPL-2.0。

**Non-Goals:**

- 寫回行事曆（新增、修改、刪除行程）、OAuth 或帳號登入、CalDAV。
- 一個行事曆一列，或依行程標題的關鍵字分列。
- 年視圖顯示行程。
- 點行程打開浮窗，或顯示地點、描述、與會者。
- 把行程存進硬碟或外掛資料（離線快取）。
- 定時自動重新讀取。
- 番茄鐘、常態列、讀 `🔄 T-` 筆記、`>` 延後痕跡、拖曳換週。

## Decisions

### 行事曆連結存在 SecretStorage，外掛資料只記名稱與鑰匙 ID

`settings.calendars` 只存 `{ name, secretId }`。設定頁每一列用 Obsidian 的 `SecretComponent` 挑選或建立一把鑰匙，鑰匙的值才是連結。每次讀取時，才用 `app.secretStorage.getSecret(secretId)` 取得連結。

- 連結不寫進外掛資料、本機偏好、console、通知或提示文字。
- 顯示錯誤時，只用行事曆的顯示名稱（沒取名就是 `行事曆 <n>`）。
- 鑰匙在這台裝置找不到值，就回報 `這台裝置找不到連結`，不猜也不重試。

替代方案是把連結直接存進外掛資料。外掛資料會被 Obsidian Sync 同步，連結也會以明文躺在 vault 的檔案裡，而 Google 的私密網址等於讀取密碼，所以不採用。

### 用 ical.js 解讀 iCal 並展開重複行程

新增依賴 ical.js 2.2.1（MPL-2.0），只在 `src/core/calendar.ts` 使用。需要它處理的部分：

- 解析 `VEVENT`。
- 用行事曆內的 `VTIMEZONE` 註冊時區。
- 用 `RRULE`、`RDATE`、`EXDATE` 展開重複行程，用 `RECURRENCE-ID` 套用例外。

外掛會從約 62 KB 變成約 140 KB（之前實際打包量過）。

替代方案一：自己寫解析器。重複規則、例外、時區的細節太多，容易在真實資料上出錯，所以不採用。

替代方案二：其他 iCal 套件，例如 node-ical。它依賴 Node.js 的模組，Obsidian 外掛環境不一定有，所以不採用。

### 純函式放在 src/core/calendar.ts

這個檔案不 import obsidian，全部用測試覆蓋：

- `normalizeCalendarAddress(raw)`：回傳要讀的網址或 `連結格式不對`。
- `parseCalendar(text)`：回傳可展開的行事曆，看不懂時丟出錯誤，由上層對應成 `內容看不懂`。
- `occurrencesInRange(calendars, from, to)`：展開並合併多個行事曆在一段時間內的行程。
  - 每個行事曆帶著它在設定裡的位置與顯示名稱。
  - 依 `UID` 加開始時間去重複。
  - 每個行程最多檢查 100,000 次，從第一次發生開始算。每天重複、從幾十年前開始的行程仍算得到顯示中的月份，寫壞的規則（例如每秒重複）也不會讓畫面卡住。
- `occurrencesForWeek(occurrences, weekLabel)`：依週一 00:00 到下週一 00:00 的重疊判斷行程屬於哪一週，並照規格排序。
- `eventLineText(occurrence)`：產生 `11/6（五）13:30 讀書會` 這類文字。

時間一律用裝置的本地時區。行事曆裡沒有定義的 `TZID`（ical.js 不附時區資料庫）當成本地時間讀，規格有例子；Google 的行事曆檔都會附自己用到的時區定義。`vitest.config.ts` 已經固定 `TZ=Asia/Taipei`，規格裡的例子算得出固定結果。

被 `RECURRENCE-ID` 改過時間的那一次，用改過之後的開始與結束判斷屬於哪一週。實作上先收集每個行程的所有例外，直接拿例外本身的時間和顯示範圍比對；展開主行程時，跳過已經有例外的那幾次，這樣不論例外被移得多遠都不會漏掉。

ical.js 的型別大多是 `any`，而本專案的 lint 有型別檢查規則。所以 ical.js 只在 `src/core/calendar.ts` 裡一個小範圍使用：解析結果在進出口轉成本專案自己定義的型別，其他地方不碰 ical.js 的物件，也不新增 `eslint-disable`。

### CalendarStore 統一讀取、合併請求、保留上次成功的結果

`src/calendar-store.ts` 是外掛層級的單一物件，所有儀表板分頁共用：

- `refresh()`：讀取所有 `secretId` 不是空字串的行事曆。
  - 讀取進行中再被呼叫，只排一次後續讀取，用那時的設定。
  - 每個行事曆成功時，換掉它的結果；失敗時，保留它上次成功的結果，並記下原因。
- `state`：包含 `running`、`started`（這次外掛執行期間是否讀取過）、`finishedAt`（本地 `HH:MM`）、`failures`（顯示名稱與原因），以及每個行事曆最後一次成功解析的內容。
  - 上次成功的內容用 `secretId` 對應，不用清單位置。刪掉或換掉鑰匙的行事曆，在下一次讀取時丟掉它的內容，其他行事曆不受影響。
- `dispose()`：外掛卸載時呼叫。之後才回來的回應、排著的下一次讀取都直接丟掉，不通知任何儀表板。
- `subscribe(listener)`：讀取開始與結束時通知儀表板。

網路請求、取得鑰匙、時鐘都由建構時注入，正式環境接 Obsidian 的 `requestUrl`（`GET`、`throw: false`）與 `app.secretStorage`，測試用假的實作，完全不連網。結果只放在記憶體，外掛卸載就丟掉。

替代方案是每個分頁各自讀取。開兩個分頁就會讀兩次，兩邊的時間和結果也可能不一致，所以不採用。

### 讀取時機只有四種

1. 儀表板分頁打開時。
2. 按 General 列的 `↻`。
3. 執行指令 `Refresh calendars`（id `refresh-calendars`）。
4. 記憶體裡的 `calendars` 跟上次讀取時用的不一樣：外掛資料存檔後、從外部重新載入後，或存檔失敗把設定還原之後。

`main.ts` 訂閱 `PluginDataStore` 的 `settings-saved`、`reloaded`、`settings-reverted`，比對 `calendars` 有沒有變。切換月份、切換年／月、筆記變動都不會讀取。沒有任何行事曆設了鑰匙時，`refresh()` 直接結束，不發任何請求。

### General 列由月視圖畫，行事曆更新走保留狀態的重繪

`MonthView` 的 host 多提供兩項資料：

- 行事曆狀態。
- 指定週的行程文字，由 view 用 `occurrencesInRange` 和 `occurrencesForWeek` 對目前月份的週算出來。

規格要求的其他行為：

- General 列畫在 tbody 第一列，沒有專案時也畫，排在 `（沒有符合條件的專案）` 上面。
- 名稱格有 `General`、狀態列、`↻`。
- 週格子用 `general-cell` 類別，沒有 `data-path`，所以不會開浮窗。
- 今天這週的欄位沿用 `today-col` 標示。

`CalendarStore` 通知讀取開始（狀態列要顯示 `讀取中…`）與結束時，view 都用跟筆記變動相同的方式重繪：保留捲動位置、年／月、顯示的月份，以及開著的浮窗，但不重新掃描筆記。這次外掛執行期間還沒開始讀取前，狀態列是空的。

說明面板的月視圖區塊加一行：`General 列：行事曆的行程，只能看；按 ↻ 重新讀取`。

年視圖完全不讀行程。

### 設定頁的 Calendars 區塊

設定頁在 `Dates` 後面新增 `Calendars` 區塊：

- 說明文字和 Google 的取得方式提示。
- 每個行事曆一列，有名稱欄、密鑰選擇器、`Delete`。
- 最後一個 `Add a calendar` 按鈕。

密鑰選擇器用 `Setting.addComponent` 搭配 `new SecretComponent(app, el)`，`setValue(secretId)` 與 `onChange` 寫回設定，走既有的 400 ms 延遲存檔。

文字照規格，維持國小五年級看得懂的英文。實作時要在 Obsidian 1.13 實際點一次密鑰選擇器，確認建立新鑰匙的步驟。README 照實際畫面寫，例如在哪裡貼上網址、鑰匙要取什麼名字。

### 授權與連網說明

- `esbuild.config.mjs` 的 banner 多兩行：`Bundles ical.js (MPL-2.0), source: https://github.com/kewisch/ical.js`。ical.js 原始碼開頭的授權註解是一般註解，壓縮時會被拿掉，所以要自己寫進 banner。
- README 英文與中文都新增連網說明，以及 Third-party code 段落。
- AGENTS.md 的隱私檢查要跟著改：
  - 憑證檢查指令排除 `main.js`，並排除 `secretId`、secret storage 這類行事曆功能本身的用語，否則每次都會誤報。
  - banner 規則允許第二個公開網址（ical.js 的原始碼位置）。
  - 專案概覽列出新的檔案。

### 版本

這次新增行事曆列與連網，版本升為 0.5.0。

## Implementation Contract

**行為：**

- 設定頁 `Calendars` 區塊可以新增、命名、選鑰匙、刪除行事曆，外掛資料只多出 `calendars: [{ name, secretId }]`。
- 至少一個行事曆設了鑰匙時，月視圖最上面出現 General 列：
  - 每週列出行程文字，依規格的例子格式與排序。
  - 名稱格顯示 `讀取中…`，或 `更新於 HH:MM`；有行事曆讀不到時，後面加上 `・⚠ N 個行事曆讀不到`，提示列出 `名稱：原因`。
- 讀取只發生在四種時機；沒設行事曆時完全不連網。
- 年視圖沒有行程。

**介面與資料形狀：**

- `DashboardSettings.calendars: { name: string; secretId: string }[]`，正規化規則照 `dashboard-settings`。
- `src/core/calendar.ts`：`normalizeCalendarAddress`、`parseCalendar`、`occurrencesInRange`、`occurrencesForWeek`、`eventLineText`。
  - 行程物件至少包含：`uid`、`title`、`allDay`、開始與結束（本地時間）、行事曆的位置與顯示名稱。
- `src/calendar-store.ts`：`CalendarStore`，含 `refresh()`、`state`、`subscribe()`、`dispose()`，依賴注入 `request`、`getSecret`、`now`；上次成功的內容用 `secretId` 對應。
- 指令 id `refresh-calendars`，名稱 `Refresh calendars`。

**失敗與錯誤處理：**

- `連結格式不對`、`這台裝置找不到連結`、`讀取失敗（HTTP <status>）`、`連不上`、`內容看不懂`，都以行事曆的顯示名稱回報在 General 列的狀態提示裡。
- 失敗的行事曆保留這次外掛執行期間上次成功的行程。
- 單一行事曆失敗不影響其他行事曆，也不影響專案列。
- 任何錯誤訊息、console 輸出、提示都不含連結。

**驗收標準：**

- `tests/calendar.test.ts`：規格裡的每個例子表格逐列測試（網址處理、週的對應、週內排序、行程文字），以及每週重複加例外的情境、取消的行程、去重複、100,000 次上限。
- `tests/calendar-store.test.ts`：用假的請求驗證以下情境：
  - 沒有行事曆就不發請求。
  - 讀取中再次呼叫只多跑一次。
  - 失敗時保留上次成功的結果。
  - 各種失敗原因的對應。
  - 狀態文字所需的資料。
  - 刪掉一個行事曆後，其他行事曆保留自己的內容與名稱。
  - `dispose()` 之後回來的回應不通知任何人。
- `tests/settings.test.ts`：`calendars` 正規化例子逐列測試。
- 建置後的 `main.js` 開頭包含 `ical.js`、`MPL-2.0`、`https://github.com/kewisch/ical.js`。
- 部署後用維護者 vault 的真實外掛資料確認不含任何 `http`、`webcal` 連結。
- 朱騏用自己的 Google 行事曆手動驗收。

**範圍內：** `calendars` 設定、設定頁 `Calendars` 區塊、`CalendarStore`、iCal 解讀與展開、General 列、`Refresh calendars` 指令、保留狀態的重繪、README 連網與第三方說明、CHANGELOG、名詞表、0.5.0。

**範圍外：** Non-Goals 列出的所有項目。

## Risks / Trade-offs

- [Google 的完整行事曆檔可能好幾 MB，解析要一兩秒] → 只在四種時機解析一次，結果留在記憶體；展開只算顯示中那個月的週，切換月份不重新解析。
- [密鑰儲存區不一定跨裝置同步，另一台電腦會讀不到] → 狀態提示寫 `這台裝置找不到連結`，README 說明每台裝置要各自設定一次。
- [Apple 行事曆要開成公開才有連結，任何拿到連結的人都看得到] → README 說明這個代價，並建議用它背後的 Google 行事曆。
- [時區處理錯誤，行程跑到錯的一天] → 規格例子涵蓋 `TZID`、UTC、整天、跨週；測試固定 `TZ=Asia/Taipei`；手動驗收比對真實行事曆。
- [外掛變大，載入稍慢] → 約 140 KB 仍小；ical.js 只在月視圖需要時才用到，但不另外做延遲載入。
- [私密網址外洩] → 連結只在讀取當下從密鑰儲存區拿出來，不寫入任何紀錄；README 提醒網址外洩時到 Google 重設私密網址。

## Migration Plan

沒有資料要搬：外掛資料缺少 `calendars` 時視為 `[]`，畫面與 0.4.0 相同，也不連網。部署後重新載入外掛即可。

回退：重新安裝 0.4.0 的 release 檔案。0.4.0 不認識 `calendars`，下次存設定時會把這個欄位拿掉，行事曆清單（名稱與鑰匙 ID）就不見了。密鑰本身仍留在 Obsidian 的密鑰儲存區，再升級時重新選回即可。

## Open Questions

（無）
