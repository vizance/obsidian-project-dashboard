# Project Dashboard

A year-at-a-glance Gantt chart for Obsidian project notes, rendered as a plugin tab. It scans a configured folder of project notes, derives each project's start/end dates and category from the filename, frontmatter, and task dates, and renders one row per project across ISO week columns — so you can see at a glance how projects are spread across the year, which ones are overloaded in the same month, and which ones have quietly slipped past their promised end date. Per-week cells come from `📅` (planned) and `✅` (done) task dates written by the [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin convention; a project whose task dates run past its end date shows an overflow segment, and a project with no scheduled tasks yet shows as settled/dashed instead of solid.

[繁體中文說明如下](#繁體中文說明)

## Install

### Manually

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/vizance/obsidian-project-dashboard/releases/latest), put them in `.obsidian/plugins/project-dashboard/` inside your vault, then enable the plugin under **Settings → Community plugins**.

### With BRAT

BRAT support is planned once the plugin has a tagged release; for now use the manual install above.

## Configure your project folder and categories

The plugin classifies project notes using rules you define in `src/core/personal-rules.local.ts`, which is git-ignored so your own project folder name, category keywords, and client/project overrides never leave your machine. On first `npm install` (or `npm run build`/`npm test`/`npm run lint`/`npm run deploy`), `scripts/ensure-local-rules.mjs` copies `src/core/personal-rules.example.ts` to `personal-rules.local.ts` if it doesn't exist yet. Edit that file to set:

- `PROJECT_FOLDER` — the vault-relative folder containing your project notes (default `Projects`)
- `KEYWORD_RULES` — filename-fragment → category keyword rules
- `MANUAL_OVERRIDES` — full project names forced into a specific category
- `EXCLUDED_PROJECTS` — project notes to skip entirely

Category labels and colors (`CATEGORIES` in `src/core/config.ts`) are not private and can be edited directly.

## Edit tasks from the week popover

In the per-week view, click a project's week cell to open that week's popover. Filled cells, empty dashed weeks, and the long dashed bar of a project that has no task dates yet all open it. From there you can:

- tick a task done, or untick it
- move a task to the previous or next week with `◀` / `▶` (the date moves by 7 days, so the weekday stays the same)
- pick one of the note's tasks that has no date yet and put it in this week
- add a new task to this week
- jump to the task's line in the note with `↗`

Every change is written straight into the project note in the Tasks plugin's emoji format, `- [ ] task 📅 YYYY-MM-DD`, and ticking a task adds `✅ <today>`. A task placed into a week (picked or newly added) is dated on that week's Friday; this is fixed for now and will become a setting together with the Saturday rule. New tasks go right after the last checkbox task in the note, and the input stays open so you can add several in a row. Checkbox lines inside code blocks or the frontmatter are never edited. Recurring tasks (`🔁`) have to be ticked in the note itself, because creating the next occurrence is the Tasks plugin's job. If the line changed in the note after the dashboard last read it, nothing is written and the dashboard asks you to try again.

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

### 設定自己的專案資料夾與分類規則

分類邏輯讀取 `src/core/personal-rules.local.ts`，這個檔案被 git 忽略，所以你的專案資料夾名稱、分類關鍵字與個案覆寫都不會外流。第一次執行 `npm install`（或 `npm run build` / `npm test` / `npm run lint` / `npm run deploy`）時，`scripts/ensure-local-rules.mjs` 會在這個檔案不存在時，自動從 `src/core/personal-rules.example.ts` 複製一份過去。打開後編輯：

- `PROJECT_FOLDER` — vault 內專案筆記所在的資料夾（預設 `Projects`）
- `KEYWORD_RULES` — 檔名關鍵字 → 分類
- `MANUAL_OVERRIDES` — 指定全名強制歸類
- `EXCLUDED_PROJECTS` — 不顯示的專案筆記

分類標籤與配色（`src/core/config.ts` 的 `CATEGORIES`）沒有隱私考量，可以直接編輯。

### 在週浮窗裡編輯任務

在逐週模式下點專案的週格子，就會打開那一週的浮窗。實心的格子、空的虛線週，還有還沒有任何任務日期的整條虛線都可以點。打開後可以：

- 勾選任務完成，或取消勾選
- 用 `◀` `▶` 把任務移到前一週或下一週（日期加減 7 天，星期幾不變）
- 從這則筆記還沒排日期的任務挑一個，排進這週
- 在這週新增一個任務
- 按 `↗` 跳到筆記裡那一行

所有改動都直接寫回專案筆記，格式固定用 Tasks 外掛的 emoji 寫法 `- [ ] 任務 📅 YYYY-MM-DD`，勾完成時會補上 `✅ 今天日期`。排進某一週的任務（挑選或新增的都算）會寫那週的星期五，目前固定，之後會跟「週六算下一週」一起開放設定。新增的任務放在筆記裡最後一個任務的下一行，輸入框會保持開著，可以連續新增好幾個。程式碼區塊與 frontmatter 裡的核取方塊不會被修改。有 `🔁` 的重複任務要到筆記裡勾，因為產生下一次的任務是 Tasks 外掛的工作。如果那一行在儀表板讀取之後又被改過，儀表板不會寫入，會請你再按一次。

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
