在專案根目錄執行 `npm run screenshots:build`。
再執行 `python3 scripts/screenshots/capture.py`（需先安裝 Python Playwright 1.63 與 Chromium）。
完成後，10 張使用虛構資料的截圖會存到 `docs/images/`；圖片依內容裁切，含說明面板與暫停列；年視圖會依全年表格寬度擴大，設定頁可用 `dist/index.html?mode=settings` 預覽。
