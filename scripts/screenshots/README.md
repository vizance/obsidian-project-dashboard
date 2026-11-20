在專案根目錄執行 `npm run screenshots:build`。
再執行 `python3 scripts/screenshots/capture.py`（需先安裝 Python Playwright 1.63 與 Chromium）。
完成後，11 張使用虛構資料的截圖會存到 `docs/images/`；圖片依內容裁切，含說明面板、暫停列與展開「之前還沒做」的手機清單；年視圖會依全年表格寬度擴大，設定頁可用 `dist/index.html?mode=settings` 預覽，手機清單可用 `dist/index.html?mode=phone` 預覽。
