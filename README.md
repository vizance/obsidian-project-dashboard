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
