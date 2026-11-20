## Context

現在的 `README.md` 有 337 行：英文在前、中文在後，內容是每個功能的細部規則（讀取時機、格式、錯誤原因等），沒有截圖。朱騏的另一個公開外掛 Bullet Zoom 用 `README.md` 加 `README.zh-TW.md` 兩份；他的 Write 編輯器教學則是「這是什麼 → 在哪裡打開 → 一個功能一段、配截圖、白話條列」。外掛的畫面是 `src/view.ts`、`src/month-view.ts`、`src/week-popover.ts` 用 Obsidian 的 DOM 輔助函式（`createEl` 等）畫出來的，資料來自 `VaultSource`（vault 檔案）與 `CalendarStore`（行事曆）。這台電腦有 Python Playwright 與 Chromium。

## Goals / Non-Goals

**Goals:**

- 第一次看到 README 的人，五分鐘內知道外掛長什麼樣、怎麼裝、怎麼開始用。
- 截圖可以重拍，而且永遠不含私人資料。
- 細節規則不丟掉，只是移出首頁。

**Non-Goals:**

- 改外掛行為、錄影片、翻譯部落格文章、寫成技術文件。

## Decisions

### README 拆成英文與中文兩份，教學在前、細節另存

`README.md`（英文）與 `README.zh-TW.md`（中文）章節完全對應，開頭互相連結。現有 README 的細部規則整理成 `docs/details.md` 與 `docs/details.zh-TW.md`。README 的每一段只寫「怎麼做、會看到什麼」，最後加一句「詳細規則見…」。

連網說明與第三方程式碼這兩段必須留在 README 本身，因為 Obsidian 的開發者政策要求網路使用要在 README 揭露。`add-calendar-row` 規格裡「README 用英文與繁體中文說明連網」的要求，改成兩份 README 都要有。

替代方案是維持單一檔案、只在前面加教學。檔案會變得很長，中文讀者要捲過整份英文，所以不採用。

### 截圖用外掛真正的畫面程式，搭配虛構資料在瀏覽器裡畫

`scripts/screenshots/` 放三樣東西：
- 一個入口程式：把 `obsidian` 換成一個很小的替身。替身只提供畫面用到的部分：
  - `createEl` 系列輔助函式、`ItemView`、`Setting` 等。
  - 假的 vault：裡面是虛構的範例專案筆記。
  - 假的 secret storage 與 `requestUrl`：回傳內建的範例 iCal 內容，不連網。
- 用 esbuild 打包成一個 HTML。
- 一支 Python Playwright 腳本：固定「今天」的日期、開頁面、依序切換年視圖、月視圖、點格子開浮窗、打開「還沒排」、勾「編輯分類與狀態」等，存成 `docs/images/*.png`。

範例資料全部是中性的：範例專案 A、範例課程、範例出版、讀書會等，跟規格裡的例子同一種寫法。替身外觀用 Obsidian 淺色主題的主要 CSS 變數，讓截圖看起來接近實際畫面。

替代方案一：在真的 Obsidian 裡建一個範例 vault 截圖。要人工操作，也很難每次重拍一致，所以不採用。

替代方案二：直接截維護者的 vault。會洩漏真實專案與客戶名稱，公開 repo 不允許，所以不採用。

### 延伸閱讀放朱騏網站的 6 篇文章

依「方法論 → 月計畫 → 週計畫 → Obsidian 實作」排列；英文版註明文章是繁體中文。

## Implementation Contract

**行為：**

- 兩份 README 章節一致、互相連結、截圖都存在、延伸閱讀 6 個連結正確。
- `docs/details*.md` 保留原本的細部規則。
- 截圖程式重跑後得到同一組圖片，只有範例資料。

**介面與資料形狀：**

- `scripts/screenshots/` 的入口程式、替身、範例資料、`capture.py`。
- `package.json` 新增 `npm run screenshots:build`，負責打包 HTML；Python 腳本由維護者另外執行。
- `docs/images/` 的 PNG 圖檔。

**失敗與錯誤處理：** 截圖腳本找不到 Playwright 或打包檔時，印出白話說明並結束，不產生半套圖片。

**驗收標準：**

- 所有圖片存在且被引用。
- `grep` 確認 README 與 docs 沒有私人名稱（`.privacy-patterns.local`）、沒有本機路徑。
- 延伸閱讀的 6 個網址都回 200。
- `npm test`、`npm run lint`、`npm run build` 照常通過（截圖程式不進 `main.js`）。
- 朱騏看過兩份 README 與截圖。

**範圍內：** 兩份 README、`docs/details*.md`、`docs/images/`、`scripts/screenshots/`、AGENTS.md 補一句重拍截圖的方法、`add-calendar-row` 規格的 README 文字。

**範圍外：** Non-Goals 列出的所有項目。

## Risks / Trade-offs

- [替身畫出來的畫面和真的 Obsidian 有落差] → 只截外掛自己的區塊，不截 Obsidian 的側欄與分頁列；Obsidian 主題的主要 CSS 變數照抄淺色主題；朱騏驗收時比對。
- [截圖程式跟著外掛變動而壞掉] → 程式放進 repo，AGENTS.md 寫明畫面改了要重拍；壞了只影響文件，不影響外掛。
- [lint 或建置掃到截圖程式] → 截圖程式不在 `src/`，eslint 與 tsconfig 的範圍照舊或明確排除。

- [截圖檢查時發現的畫面問題] → 2026-11-20 逐張檢查時發現兩件事並已修正：設定頁的行事曆連結欄改成密碼欄後，不再符合原本 `input[type="text"]` 的寬度規則，被擠窄、提示字被切掉，`styles.css` 補上密碼欄的寬度；說明面板截圖的下緣透出後面表格的字，截圖程式拍說明面板時先把表格藏起來。

## Migration Plan

純文件與工具，沒有資料要搬。

## Open Questions

（無）
