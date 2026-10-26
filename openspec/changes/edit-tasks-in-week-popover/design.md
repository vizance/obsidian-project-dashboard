## Context

儀表板第一個 change 把年視圖搬進 Obsidian，筆記一改畫面就更新，但仍然只能看。週浮窗目前把格子的 `title` 文字原樣貼出來，掃描器只讀有 `📅`／`✅` 日期的行，而且不記行號，所以沒有辦法回頭改筆記裡的某一行，也看不到沒寫日期的任務。

使用者的方法裡，專案筆記是任務的唯一正本，週五規劃時把任務排進下週並把日期標在那週星期五（見 openspec/LANGUAGE.md 的 `occupied`）。任務採 Obsidian Tasks 外掛的 emoji 格式，完成時會補 `✅ 完成日`。

限制：

- `src/core/*` 不能 import `obsidian`，才能用 vitest 直接測。
- 筆記改動會觸發既有的 400 ms debounce 重新掃描與重繪（`dashboard-note-sync`），重繪會換掉整張表。
- 沒有任何任務日期的專案在逐週模式畫成一條橫跨多週的虛線（`span-dashed`），表格每週仍有自己的 `td`，虛線是畫在起始格裡、用寬度蓋過後面的格子。

## Goals / Non-Goals

**Goals:**

- 在逐週模式的週浮窗裡完成五個動作：勾完成（也能取消）、◀ ▶ 換週、把還沒排日期的任務排進這週、新增任務、跳到筆記那一行。
- 所有寫入走同一個寫入模組，寫入當下確認那一行跟掃描時一樣，不一樣就不寫。
- 空的週格（虛線週格、整條虛線）也能打開浮窗，才能把第一個任務排進去。
- 連續操作時浮窗不會因為重繪而消失。

**Non-Goals:**

- 月視圖、General 列、番茄鐘加總（第二階段）。
- 延後的 `>` 痕跡與「被移過幾次」的紀錄。
- 設定頁：排進某週寫星期幾、週六算下一週，這兩條之後一起開放。
- 手機版、拖曳換週、timeline 模式下的編輯。
- 改任務文字、刪除任務、勾選重複任務（`🔁`，交回筆記處理）。
- 在專案區間外的空白格排任務（會變成 overflow，使用者應先改預計結束日期）。
- 呼叫 Tasks 外掛的 API。

## Decisions

### 任務行模型與掃描

新增純邏輯模組 src/core/task-lines.ts，`parseTaskLines(text)` 逐行產生 `TaskLine`，`scanProjectNote` 把結果放進新欄位 `task_lines`。只要一行是核取方塊任務，或含有至少一個 `📅`／`✅` ISO 日期，就算一個任務行；其他行略過。既有的 `tasks`、`task_dates`、`occupied_weeks`、`settled_weeks` 照舊由原本的函式計算，不改值也不改算法。

替代方案：直接擴充既有的 `TaskEntry`。`TaskEntry` 是「一個日期一筆」，同一行有 `📅` 和 `✅` 會出現兩筆，拿來對應「改哪一行」會重複，所以另開以行為單位的模型。

核取方塊只認 `[ ]`、`[x]`、`[X]`；`[/]`、`[-]` 這類自訂狀態視為一般行，在浮窗裡只能看、只能跳過去，避免寫錯別的外掛的狀態。

### 單一寫入模組與寫入前比對

新增 src/task-writer.ts 的 `TaskWriter`，所有改筆記的動作都呼叫它。它用 Obsidian 的 `Vault.process` 讀改寫，在回呼裡：

1. 依原本的換行符號切行（檔案含 `\r\n` 就用 `\r\n`），保留檔尾換行。
2. 找目標行：同一個行號且文字完全相同就用它；否則全檔只有一行文字完全相同時用那一行（使用者在上面加了幾行的情況）；兩者都不成立就丟出內部錯誤，`Vault.process` 不會寫入。
3. 用目前那一行的文字重新判斷前提（例如換週需要有 `📅` 且未完成），不成立同樣不寫。

結果回傳 `ok`、`stale`、`invalid`、`missing-file` 四種，畫面依結果提示。替代方案是每個按鈕各自改 Markdown，容易各寫各的規則，也很難保證不會蓋掉使用者剛打的字。

### 排程日期規則集中一處

排進某週寫「那週星期一加 4 天」，也就是星期五；換週把第一個 `📅` 日期加減 7 天，所以星期幾不變。兩條規則的常數與 `scheduleDateForWeek` 放在 src/core/task-lines.ts 同一處，之後開放設定只改這裡；src/core/weeks.ts 只提供不含個人規則的日期運算。週六算下一週的規則目前在 `taskDateToWeekLabel`（src/core/weeks.ts）與 `computeOccupiedWeeks`（src/core/scan.ts）各有一份，本次不動，開放設定的那個 change 再一起收斂。

替代方案：每次跳出日期選擇器。週五規劃一次要排很多個任務，每個都選日期太慢，已在討論時否決。

### 新增任務插在最後一個任務行之後

新任務寫成 `- [ ] <文字> 📅 <那週星期五>`，插在全檔最後一個核取方塊任務行的下一行，沒有任何任務行時接在檔尾。使用者輸入的文字先把換行與連續空白收成一個空格；已經自己打了 `📅 YYYY-MM-DD` 就不再補日期；空字串不寫。替代方案是插在特定標題底下，但每個人的筆記標題不同，第一版先用最好預測的位置。

### 勾完成自己改行，不呼叫 Tasks 外掛

勾完成：`[ ]` 改成 `[x]`，沒有 `✅` 時在行尾補 ` ✅ 今天`；取消：改回 `[ ]` 並移除所有 ` ✅ 日期`。行尾有區塊 ID（` ^abc123`）時，新標記插在區塊 ID 前面。重複任務（含 `🔁`）的勾選框停用，提示到筆記裡勾。今天的日期用 `todayLocal()`，避免台北清晨被算成前一天。

替代方案：呼叫 Tasks 外掛的 API 讓它處理重複任務與完成日。會多一個外部相依，公開版使用者不一定有裝，第一版不做。

### 浮窗獨立成元件

新增 src/week-popover.ts 的 `WeekPopover`，負責畫浮窗內容、處理按鈕與兩個展開區塊（還沒排日期的任務、新增任務輸入框）。view.ts 只負責決定哪一格能開、算位置、接上寫入模組與 toast。view.ts 已經接近 700 行，再塞進去會很難維護。

### 虛線週格與整條虛線可開浮窗

逐週模式下，每個畫出來的週格都帶 `data-path` 與 `data-week`。可點開浮窗的格子：實心、已完成、overflow、虛線週格，以及整條虛線。整條虛線帶起始週索引與跨幾週，點擊時用「點擊位置到虛線左緣的距離 ÷ 每週寬度」算出是哪一週，浮窗對齊那一週的表格格子。區間外的空白格不開。timeline 模式維持原本行為：點色條只顯示它的文字，不能編輯。

### 重繪後在同一格重新打開浮窗

浮窗記住「筆記路徑＋ISO 週」與目前展開的區塊。自動重繪前先記下來，重繪後找到同一個專案、同一週、仍可開浮窗的格子就重新打開並還原展開的區塊；找不到（例如專案被隱藏）就關閉。寫入進行中，那一行的按鈕先停用，勾選框先顯示目標狀態，等重繪帶回新內容。

## Implementation Contract

**行為**

- 逐週模式下點擊實心、已完成、overflow、虛線週格或整條虛線，打開該專案、該週的浮窗；同一格再點一次關閉。
- 浮窗標題兩行：專案名稱；`W44　10/26（一）– 11/1（日）`。overflow 週另加 `⚠ 已超出預計結束日期 <end>`。
- 每個任務行一列：勾選框、任務文字、日期標籤（未完成 `10/30（五）`，已完成 `已完成 10/27`，週六算到本週的加 `六 → 本週`）、`◀` `▶` `↗`。沒有任務時顯示 `這週還沒有任務`。
- 底部兩個入口：`＋ 從還沒排日期的任務挑一個（N）`，展開後依筆記順序列出，點一個就寫入；沒有時顯示 `這則筆記沒有還沒排日期的任務`。`＋ 新增任務`，展開輸入框，placeholder `輸入任務，Enter 加入，Esc 取消`。
- `↗` 在儀表板右側的筆記分割（與點專案名稱共用同一個分割）打開筆記，選取那一整行並捲到畫面中，浮窗關閉。

**介面與資料形狀**

- `TaskLine`（src/core/task-lines.ts）：`line`（掃描時的 0 起算行號）、`raw`（原始行文字，不含換行）、`text`（顯示文字，規則同既有 `cleanTaskText`）、`checkbox`、`done`（勾選或含 `✅`，與既有 `parseTasks` 判斷一致）、`due`（第一個 `📅` 日期或 null）、`doneDate`（第一個 `✅` 日期或 null）、`recurring`（含 `🔁`）、`dates`（行內所有 `📅`／`✅` 日期，依出現順序）。
- `ProjectRecord.task_lines: TaskLine[]`，依行號排序。
- 純函式（src/core/task-lines.ts）：`taskLinesForWeek(lines, weekLabel)`、`unscheduledTasks(lines)`、`toggleDoneLine(raw, today)`、`shiftDueLine(raw, days)`、`scheduleLine(raw, date)`、`buildNewTaskLine(text, date)`、`newTaskInsertIndex(lines)`、`locateLine(lines, index, expected)`、`scheduleDateForWeek(weekLabel)`。
- 日期函式（src/core/weeks.ts）：`addDaysISO(date, days)`、`mondayOfWeek(weekLabel)`、`weekRangeLabel(weekLabel)`。
- 整條虛線換算週（src/core/cells.ts）：`spanWeekOffset(offset, width, weeks)`，回傳 0 到 `weeks - 1` 之間的整數。
- `TaskWriter.apply(edit)`，`edit` 為 `toggle`、`shift`、`schedule`、`add` 四種，回傳 `{ status: 'ok' | 'stale' | 'invalid' | 'missing-file' }`。

**失敗模式**

- `stale` 或 `invalid`：不寫入，toast 顯示 `這一行在筆記裡剛被改過，畫面已更新，請再試一次`，儀表板立即重新掃描並重繪，浮窗在同一格重開。
- `missing-file`：不寫入，toast 顯示 `找不到這則筆記`。
- `↗` 找不到那一行：照常打開筆記，toast 顯示 `找不到那一行，可能剛被改過`。
- 寫入失敗不靜默：每種失敗都有 toast；成功不顯示 toast，畫面更新就是回饋。

**驗收**

- `npm test` 通過，新增 tests/task-lines.test.ts、tests/task-writer.test.ts，並擴充 tests/weeks.test.ts、tests/scan.test.ts，涵蓋規格中的每個 Example。
- `npm run lint` 0 錯誤，`npm run build` 成功。
- 在 Obsidian 手動確認：勾完成與取消、◀ ▶、排進空的一週、新增任務、↗、在筆記裡先改那一行再按按鈕會出現提示且筆記沒被改。

**範圍**

- 在範圍內：上面列的五個動作、可開浮窗的格子擴充、重繪後重開浮窗、浮窗內捲動不關閉、輸入框裡按 Esc 只取消輸入。
- 不在範圍內：Non-Goals 列出的所有項目；既有欄位與畫格規則的任何改動。

## Risks / Trade-offs

- [使用者正在編輯器裡打字時，儀表板同時寫入同一則筆記] → `Vault.process` 是 Obsidian 建議的背景改檔方式，會與開著的編輯器同步；寫入前比對整行文字，那一行被改過就不寫。
- [筆記裡有兩行一模一樣的任務，而且其中一行移動過] → 行號對不上又不只一行相同時視為 `stale`，寧可不寫也不改錯行。
- [重繪有 400 ms 延遲，按下去像沒反應] → 勾選框先顯示目標狀態、那一行先停用，等重繪帶回結果。
- [公開版使用者的 Tasks 設定不是 emoji 格式或沒有開完成日] → 第一版固定寫 emoji 格式並補完成日，與掃描器只讀 emoji 格式一致；README 寫明。
- [週六規則有兩份實作] → 本次不動，記在「排程日期規則集中一處」，開放設定時一起收斂。

## Migration Plan

資料欄位只增加不修改，沒有既有資料要轉換。版本升到 0.2.0；有問題時改回上一版的 `main.js`、`manifest.json`、`styles.css` 即可。

## Open Questions

無。設計假設已在討論時逐條確認。
