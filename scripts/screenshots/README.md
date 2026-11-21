在專案根目錄執行 `npm run screenshots:build`。
再執行 `python3 scripts/screenshots/capture.py`（需先安裝 Python Playwright 1.63 與 Chromium）。
完成後，11 張使用虛構資料的截圖會存到 `docs/images/`；圖片依內容裁切，含說明面板、暫停列與手機月視圖。年視圖會依全年表格寬度擴大，設定頁可用 `dist/index.html?mode=settings` 預覽，手機月視圖可用 `dist/index.html?mode=phone` 預覽。

手機月視圖存為 `phone-month-view.png`，以 390 × 844 像素畫布拍攝，日期固定為 2026-11-20，顯示 2026 年 11 月。拍攝前會量測 390 與 800 像素寬的版面，確認名稱欄固定在左邊、直放可左右滑看其他週、寬度夠時整個月完整顯示，以及浮窗沒有超出螢幕。圖片從左上角裁切，寬 390 像素，高度取控制列與表格的下緣，含下方留白，最多 1000 像素。
