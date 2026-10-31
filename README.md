# Project Dashboard

A year-at-a-glance Gantt chart for Obsidian project notes, rendered as a plugin tab. It scans a configured folder of project notes, derives each project's start/end dates and category from the filename, frontmatter, and task dates, and renders one row per project across ISO week columns — so you can see at a glance how projects are spread across the year, which ones are overloaded in the same month, and which ones have quietly slipped past their promised end date. Per-week cells come from `📅` (planned) and `✅` (done) task dates written by the [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin convention; a project whose task dates run past its end date shows an overflow segment, and a project with no scheduled tasks yet shows as settled/dashed instead of solid.

[繁體中文說明如下](#繁體中文說明)

## Install

### Manually

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/vizance/obsidian-project-dashboard/releases/latest), put them in `.obsidian/plugins/project-dashboard/` inside your vault, then enable the plugin under **Settings → Community plugins**.

### With BRAT

BRAT support is planned once the plugin has a tagged release; for now use the manual install above.

## Configure the dashboard

Everything is configured inside Obsidian, under **Settings → Project Dashboard**. No source editing, no rebuild. The settings tab is in English; the dashboard itself (year view, month view, and week popover) is in Traditional Chinese. The tab has three sections.

**`Project notes`**

- `Project folder` — the vault-relative folder holding your project notes, default `Projects`. Only notes directly inside that folder are scanned, never its subfolders. When no folder matches what you typed, the hint `Can't find this folder.` appears under the field; clearing the field falls back to `Projects`.
- `Projects to skip` — one filename fragment per line. A project note whose name contains any of these never shows up on the dashboard.

**`Categories`**

An ordered list of rules: a project whose name contains the rule's text gets the rule's category. The list is matched from top to bottom and **the first matching rule wins**, so keep a longer word above a shorter word it contains (`企業內訓` above `內訓`). A project that matches no rule is classified as `other`. Each row has `Move up`, `Move down`, and `Delete`; `Add a rule` appends an empty row, which survives saving and takes no part in classification until you type something into it.

The ten default rules are, in order: `企業內訓` → `企業內訓` (corporate), `內訓` → `企業內訓`, `線上課程` → `線上課程 / Cohort` (online course), `課程` → `線上課程 / Cohort`, `出版` → `出版` (publishing), `教練` → `1-on-1 教練` (coaching), `諮詢` → `1-on-1 教練`, `業配` → `業配 / 合作` (sponsorship), `合作` → `業配 / 合作`, `生活` → `生活` (life).

A category you pick by hand on the dashboard (`編輯分類` on a project row) wins over every rule, and applies only to the project whose full name matches.

**`Dates`**

- `Which day to write` — the weekday written into the note when you schedule a task into a week from the week popover. Default `Friday`.
- `Saturday tasks count for next week` — off by default. When it is on, a task dated on a Saturday is shown in the following week, which is how "on Saturday I set up next week's work" reads on the chart; when it is off, a Saturday task stays in its own week.

Settings are saved into the vault's plugin data (`.obsidian/plugins/project-dashboard/data.json`), next to the category choices you make by hand, 400 ms after your last edit; an open dashboard then re-scans and re-renders by itself. Obsidian Sync carries that file like any other plugin data, so settings changed on one computer arrive on the others. Nothing you configure is stored in this repository.

Category labels and colors (`CATEGORIES` in `src/core/config.ts`) are the one thing still edited in source.

## The year view and the month view

The controls row has a `年` / `月` switch, and `M` toggles between the two as well. The year view is the whole-year chart described above. The month view shows one month at a time and writes the tasks into the cells, which is what weekly planning usually needs.

In the month view the controls row also shows `◀`, the month title, `▶`, and `本月`. The title reads `2026 年 10 月（W41–W44）`: the year, the month, and the weeks that month holds. `◀` and `▶` step one month back or forward, across year boundaries; `本月` returns to the month of today's week. The month view always opens on the month of today's week — when you switch into it, and when you reopen the dashboard after restarting Obsidian. Only the year-versus-month choice is remembered, never the month you were last looking at. Changing the month, or switching between the two views, closes an open popover.

A week belongs to the month its **Monday** falls in. October 2026 is therefore W41–W44 and November 2026 is W45–W49 — the same way you fill in a weekly table, by the week's Monday. The one exception is week 1, which always counts as January, even when its Monday is still in December. The year view's month and quarter headers follow the same rule, so both views say the same thing about any week.

Each week cell lists the project's task lines for that week: the same lines, in the same order, as the week popover for that week. Three text styles:

- `✓` in front of greyed text — the task is done.
- Red text — the week is over and the task is not done.
- Normal text — everything else.

The cell's background and border follow the same cell kind as the year view: filled for a week with tasks, dimmed when they are all done, red for a week past the project's expected end date, dashed for a week inside the project's range with no task. A cell outside the project's range stays blank and shows nothing, even when a task happens to be dated in that week.

Click a cell to open the same week popover the year view opens, anchored on that cell, with every editing action available; clicking the same cell again closes it. This works even when the year view was left in timeline mode, because timeline mode applies to the year view only — and so does `T`: pressing `T` in the month view changes nothing.

The last column, `還沒排`, shows how many of the project's tasks have no date yet, and stays empty when there are none. Click the count to open a popover — the same single popover the week cells use — which lists those undated tasks in note order. Each row has `↗` and one button per week of the shown month (`W41`, `W42`, `W43`, `W44`). A week button schedules that task into that week, writing exactly the date the week popover would write: the weekday from `Which day to write`, with the `Saturday tasks count for next week` exception. Weeks outside the project's range are greyed out and cannot be picked; `↗` jumps to the task's line in the note. After a task is scheduled the popover stays open with one row fewer, and it closes once the last one is gone. An empty cell does nothing.

## Edit tasks from the week popover

Click a project's week cell to open that week's popover: the year view's cells in the per-week view mode — filled cells, empty dashed weeks, and the long dashed bar of a project that has no task dates yet — and the month view's cells. (The month view's `還沒排` column opens the same popover showing the undated-task list described above, not a week.) From there you can:

- tick a task done, or untick it
- move a task to the previous or next week with `◀` / `▶` (the date moves by 7 days, so the weekday stays the same)
- pick one of the note's tasks that has no date yet and put it in this week
- add a new task to this week
- jump to the task's line in the note with `↗`
- open the note beside the dashboard by clicking the project name at the top of the popover

Every change is written straight into the project note in the Tasks plugin's emoji format, `- [ ] task 📅 YYYY-MM-DD`, and ticking a task adds `✅ <today>`. A task placed into a week (picked or newly added) is dated on the weekday chosen in `Which day to write`, that week's Friday by default. When you choose `Saturday` while `Saturday tasks count for next week` is on, the Saturday before that week's Monday is written instead, so the task still shows in the week you picked. New tasks go right after the last checkbox task in the note, and the input stays open so you can add several in a row. Checkbox lines inside code blocks or the frontmatter are never edited. Recurring tasks (`🔁`) have to be ticked in the note itself, because creating the next occurrence is the Tasks plugin's job. If the line changed in the note after the dashboard last read it, nothing is written and the dashboard asks you to try again.

If your Tasks plugin uses the Dataview format or doesn't add done dates, the dashboard still writes the emoji format above.

## Development

```bash
npm install
npm test          # vitest, must stay green
npm run lint       # eslint with the Obsidian plugin rules, must report 0 errors
npm run build      # type-check, then bundle to main.js
```

To deploy a build into a vault for manual testing, set the vault path either via an environment variable or a git-ignored local config file, then run `npm run deploy`:

```bash
OBSIDIAN_VAULT="/path/to/your/vault" npm run deploy
# or create deploy.local.json: { "vault": "/path/to/your/vault" }
```

## Specifications

This project is developed spec-first with [Spectra](https://github.com/0xfdb/spectra). `openspec/specs/` holds the current behavioral specification for each capability; read `openspec/LANGUAGE.md` first to align on vocabulary (status, promised_end, overflow, closed, …).

---

## 繁體中文說明

把 Obsidian 裡的專案筆記自動畫成一張年度甘特圖，用外掛分頁呈現。外掛掃描你指定的專案資料夾，從檔名、frontmatter 與筆記內的任務日期推算每個專案的起訖日與分類，再依 ISO 週欄位畫成一條一條的色條，讓你一眼看完整年所有專案的時間分布、哪個月份塞太多專案、哪個專案已經偷偷拖過原本承諾的結束日。每週儲存格的狀態來自筆記裡 `📅`（預計）與 `✅`（完成）的任務日期，沿用 Obsidian Tasks 外掛的標記慣例；任務日期超出專案結束日時會畫出溢出色段，還沒排定任務的部分則顯示為已結算或虛線，而不是實線。

### 安裝

從[最新發布版本](https://github.com/vizance/obsidian-project-dashboard/releases/latest)下載 `main.js`、`manifest.json`、`styles.css`，放進你的 vault 裡的 `.obsidian/plugins/project-dashboard/`，再到**設定 → 第三方外掛**開啟。

### 設定儀表板

所有設定都在 Obsidian 裡的**設定 → Project Dashboard**，不用改程式、不用重新建置。設定頁的文字是英文，儀表板本身（年視圖、月視圖與週浮窗）是繁體中文。設定頁分三區。

**`Project notes`（專案筆記）**

- `Project folder`（專案資料夾）— vault 內放專案筆記的資料夾，預設 `Projects`。只讀這一層，不含子資料夾。找不到你填的資料夾時，欄位下方會顯示 `Can't find this folder.`（找不到這個資料夾）；欄位清空時會回到 `Projects`。
- `Projects to skip`（不列入的專案）— 一行一個檔名片段。檔名包含其中任何一段的專案筆記不會出現在儀表板。

**`Categories`（分類）**

一份有順序的規則清單：專案名稱包含規則左邊的文字，就歸到右邊的分類。由上往下比對，**第一個符合的規則生效**，所以較長的詞要排在包含它的短詞上面（`企業內訓` 排在 `內訓` 之前）。沒有任何規則符合的專案歸到 `other`。每一列都有 `Move up`（上移）、`Move down`（下移）、`Delete`（刪除）；按 `Add a rule` 會加一列空白規則，存檔後不會消失，在你打字之前不參與分類。

十條預設規則依序是：`企業內訓` → 企業內訓、`內訓` → 企業內訓、`線上課程` → 線上課程 / Cohort、`課程` → 線上課程 / Cohort、`出版` → 出版、`教練` → 1-on-1 教練、`諮詢` → 1-on-1 教練、`業配` → 業配 / 合作、`合作` → 業配 / 合作、`生活` → 生活。

在儀表板上手動指定的分類（專案列的 `編輯分類`）優先於所有規則，而且只影響全名相同的那個專案。

**`Dates`（日期規則）**

- `Which day to write`（排進某週時寫星期幾）— 從週浮窗把任務排進某一週時，寫進筆記的那一天。預設 `Friday`（星期五）。
- `Saturday tasks count for next week`（週六的任務算到下一週）— 預設關閉。開啟後，日期寫週六的任務會顯示在下一週，對應「週六先排好下週要做的事」的習慣；關閉時週六的任務算在當週。

設定存進 vault 裡的外掛資料（`.obsidian/plugins/project-dashboard/data.json`），和你手動指定的分類放在同一份，在最後一次修改後 400 ms 存檔；開著的儀表板接著自己重新掃描、重繪。Obsidian Sync 會像同步其他外掛資料一樣同步這個檔案，所以在一台電腦改的設定會傳到其他電腦。你的設定不會留在這個 repository 裡。

分類標籤與配色（`src/core/config.ts` 的 `CATEGORIES`）是唯一還要改程式的部分。

### 年視圖與月視圖

控制列有一組 `年` / `月` 切換，按 `M` 也能切換。年視圖就是上面說的那張整年的圖；月視圖一次顯示一個月，格子裡直接寫出任務，這是每週規劃時通常需要的樣子。

月視圖時，控制列還會出現 `◀`、月份標題、`▶`、`本月`。標題寫成 `2026 年 10 月（W41–W44）`：年、月，以及這個月有哪幾週。`◀` `▶` 往前或往後一個月，可以跨年；`本月` 回到今天這週所屬的月份。月視圖永遠從今天這週所屬的月份開始——切進月視圖時是這樣，重開 Obsidian 再打開儀表板時也是這樣。只有「年或月」這個選擇會被記住，上次看的是哪個月不會。切換月份，或在兩個視圖之間切換，都會關掉開著的浮窗。

一週屬於它**星期一**落在的那個月。所以 2026 年 10 月是 W41–W44，11 月是 W45–W49，和你照著週一填週表格的方式一樣。唯一的例外是第 1 週，它永遠算一月，即使它的星期一還在去年 12 月。年視圖的月份與季度表頭用同一條規則，所以兩個視圖對任何一週的說法都相同。

每個週格子列出該專案那一週的任務行：和那一週的週浮窗完全相同的行、相同的順序。三種文字樣式：

- 灰字前面加 `✓`——任務已完成。
- 紅字——那一週已經過了，任務還沒完成。
- 一般文字——其他情況。

格子的底色與邊框跟年視圖同一週的格子種類一致：那一週有任務就是實心，任務全部完成就變淡，超過專案預計結束日期的那幾週是紅色，在專案區間內但沒有任務的那一週是虛線。不在專案區間的格子是空白的，什麼都不顯示，就算剛好有任務的日期落在那一週也一樣。

點格子會打開年視圖打開的那個週浮窗，錨點就在那一格，所有編輯動作都能用；再點同一格就關掉。年視圖存在 timeline 模式時也一樣可以點，因為 timeline 模式只作用在年視圖——`T` 也是：在月視圖按 `T` 什麼都不會改。

最後一欄 `還沒排` 顯示這個專案還有幾個任務沒有日期，沒有時留白。點那個數字會打開一個浮窗——和週格子用的是同一個浮窗——按筆記裡的順序列出這些還沒排日期的任務。每一列有 `↗`，以及顯示中那個月每一週一顆按鈕（`W41`、`W42`、`W43`、`W44`）。按週按鈕就把那個任務排進那一週，寫進筆記的日期和週浮窗寫的完全一樣：`Which day to write` 設定的那一天，以及 `Saturday tasks count for next week` 的例外。不在專案期間的那幾週按鈕是灰的，按不下去；`↗` 跳到筆記裡那一行。排好一個之後浮窗會留著，少一列，排完最後一個就關掉。留白的格子點了沒有反應。

### 在週浮窗裡編輯任務

點專案的週格子，就會打開那一週的浮窗：逐週模式下年視圖的格子（實心的格子、空的虛線週，還有還沒有任何任務日期的整條虛線），以及月視圖的格子。（月視圖的 `還沒排` 欄打開的是同一個浮窗，裡面是上面說的那份還沒排日期的任務清單，不是某一週。）打開後可以：

- 勾選任務完成，或取消勾選
- 用 `◀` `▶` 把任務移到前一週或下一週（日期加減 7 天，星期幾不變）
- 從這則筆記還沒排日期的任務挑一個，排進這週
- 在這週新增一個任務
- 按 `↗` 跳到筆記裡那一行
- 點浮窗最上方的專案名稱，在儀表板右側打開這則筆記

所有改動都直接寫回專案筆記，格式固定用 Tasks 外掛的 emoji 寫法 `- [ ] 任務 📅 YYYY-MM-DD`，勾完成時會補上 `✅ 今天日期`。排進某一週的任務（挑選或新增的都算）會寫 `Which day to write` 設定的那一天，預設是那週的星期五；選 `Saturday` 又開著 `Saturday tasks count for next week` 時，寫的是那週星期一前面的那個星期六，所以任務仍然顯示在你挑的那一週。新增的任務放在筆記裡最後一個任務的下一行，輸入框會保持開著，可以連續新增好幾個。程式碼區塊與 frontmatter 裡的核取方塊不會被修改。有 `🔁` 的重複任務要到筆記裡勾，因為產生下一次的任務是 Tasks 外掛的工作。如果那一行在儀表板讀取之後又被改過，儀表板不會寫入，會請你再按一次。

如果你的 Tasks 外掛設定成 Dataview 格式，或沒有開啟完成日期，儀表板仍然會寫上面的 emoji 格式。

### 開發

```bash
npm install
npm test          # vitest，須保持全綠
npm run lint       # eslint，套用 Obsidian 外掛規則，須為 0 錯誤
npm run build      # 先型別檢查，再打包成 main.js
```

部署到 vault 做手動測試前，先用環境變數或 git 忽略的本機設定檔指定 vault 路徑，再執行 `npm run deploy`：

```bash
OBSIDIAN_VAULT="/path/to/your/vault" npm run deploy
# 或建立 deploy.local.json：{ "vault": "/path/to/your/vault" }
```

### 規格文件

本專案採用 [Spectra](https://github.com/0xfdb/spectra) 做 Spec-Driven Development。`openspec/specs/` 是每個 capability 目前的行為規格；建議先讀 `openspec/LANGUAGE.md` 對齊詞彙（status、promised_end、overflow、closed 等）。
