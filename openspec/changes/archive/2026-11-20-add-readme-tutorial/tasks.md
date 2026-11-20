## 1. 截圖

- [x] 1.1 截圖程式（README teaches setup and everyday use；設計：截圖用外掛真正的畫面程式，搭配虛構資料在瀏覽器裡畫）：`scripts/screenshots/` 放入口程式、`obsidian` 替身、範例專案與範例 iCal、`capture.py`；`package.json` 加 `npm run screenshots:build` 打包成 HTML；固定今天為 `2026-11-20`；截圖清單：年視圖主畫面、週浮窗、月視圖（含 General 列與名稱標籤）、「還沒排」浮窗、編輯分類與狀態、顯示暫停、設定頁 Calendars 區塊。驗證：在 Python Playwright 跑 `capture.py` 產生全部圖片；`npm test`、`npm run lint`、`npm run build` 照常通過，`main.js` 不含截圖程式。
- [x] 1.2 檢查截圖（設計：截圖用外掛真正的畫面程式，搭配虛構資料在瀏覽器裡畫）：逐張看過，畫面完整、沒有被切掉、文字清楚、只有範例資料。驗證：主代理逐張檢視並記錄問題，修到全部可用。

## 2. 文件

- [x] 2.1 兩份 README 教學與細節文件（README teaches setup and everyday use；設計：README 拆成英文與中文兩份，教學在前、細節另存、延伸閱讀放朱騏網站的 6 篇文章）：寫 `README.md` 與 `README.zh-TW.md`，章節照規格順序、互相連結、每段配截圖；原本的細部規則搬到 `docs/details.md` 與 `docs/details.zh-TW.md`；連網說明與第三方程式碼留在兩份 README；延伸閱讀 6 個連結；AGENTS.md 補「畫面改了要重拍截圖」與重拍方法；`add-calendar-row` 規格的 README 文字改成兩份 README。驗證：6 個網址都回 200；所有圖片路徑存在；私人名稱與本機路徑檢查沒有命中；重讀兩份確認一致。
- [x] 2.2 朱騏看過兩份 README 與截圖。驗證：朱騏在對話中確認。
