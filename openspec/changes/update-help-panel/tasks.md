## 1. 說明面板

- [x] 1.1 四區內容與示範（Help panel content；設計：四區、一行一個，示範沿用真的樣式類別、面板太長時在面板裡捲動）：src/view.ts 的 `buildHelpPanel` 照規格補上圖示說明新的四行、月視圖新的兩行、新的「操作」區；示範色塊沿用畫面上的類別（暫停斜線紋與 `⏳ 暫停` 標籤、灰色、今天欄、`⚠`、名稱標籤、還沒排數字）；styles.css 讓面板有最大高度並在內部捲動。驗證：tests/help-panel.test.ts 確認四區與規格情境要求的文字都在；`npm test`、`npm run lint`、`npm run build` 通過。
- [ ] 1.2 分頁與分組（Help panel content；設計：改成分頁與分組（2026-11-20 朱騏回饋））：src/view.ts 的 `buildHelpPanel` 改成 `年視圖`、`月視圖`、`操作` 三個分頁，打開面板時預設選中目前的視圖，被選中的分頁粗體加底線、可用方向鍵切換；每個分頁內照規格的小標題分組與文字；styles.css 加分頁與分組樣式。驗證：tests/help-panel.test.ts 涵蓋規格四個情境；`npm test`、`npm run lint`、`npm run build` 通過；截圖程式的 help-panel.png 改拍年視圖與月視圖兩張分頁。

## 2. 驗收

- [ ] 2.1 朱騏打開 `?` 面板確認每個樣式都有說明、示範看得懂。驗證：朱騏在對話中確認。
