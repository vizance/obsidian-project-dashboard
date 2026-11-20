## 1. 純邏輯

- [x] 1.1 暫停的過濾與新檔名（Paused projects are hidden behind their own toggle；Changing a project's status from the dashboard；單一 closed 切換控制；設計：暫停的專案藏在自己的勾選框後面，數量一直顯示、狀態選單放進既有的編輯模式，改法就是改檔名開頭的符號）：src/core/cells.ts 的 `visibleProjects` 加上 `showPaused`；src/core/scan.ts 新增依狀態算新檔名的純函式（只換開頭的狀態符號與後面的空白，沒有就加上）。驗證：tests/scan.test.ts 逐列比對「new filename」四列；tests/cells.test.ts 涵蓋 `showPaused` 開／關、「Paused projects are hidden with a count」的 13／15 與數量 2、closed 範例改成 13／20。

## 2. 畫面

- [x] 2.1 `顯示暫停（<n>）` 勾選框與暫停樣式（Paused projects are hidden behind their own toggle；設計：暫停的專案藏在自己的勾選框後面，數量一直顯示）：src/view.ts 在「顯示已結案」旁加勾選框，`<n>` 為 0 時不出現、每次掃描更新數字、分頁打開時不勾；年視圖與月視圖共用的列過濾加上暫停；暫停的列加 `status-pending` 類別，styles.css 讓色條與月視圖格子約 0.6 不透明度、保留分類色。驗證：「Paused projects are hidden with a count」「No paused projects, no checkbox」列入 3.3 手動驗收；既有測試全數通過。
- [x] 2.2 編輯模式的狀態選單（Changing a project's status from the dashboard；Category editor visibility toggle；設計：狀態選單放進既有的編輯模式，改法就是改檔名開頭的符號）：「編輯分類」改名為 `編輯分類與狀態`，同一個 CSS 類別控制 `.status-select`；src/project-column.ts 在分類選單旁畫狀態選單（`🚧 進行中`、`⏳ 暫停`、`✅ 完成`、`❌ 取消`，顯示目前狀態）；選了就用 `app.fileManager.renameFile` 依 1.1 的函式改名；同名不改並顯示 `已經有同名的筆記，狀態沒有改`、選單回到原狀態；筆記不見用既有提示；改名丟出錯誤顯示 `狀態沒有改，請再試一次`。驗證：「Pausing and resuming a project」「A name collision changes nothing」列入 3.3 手動驗收；既有測試全數通過。
- [x] 2.3 暫停列的標示（Paused projects are hidden behind their own toggle；設計：暫停的專案藏在自己的勾選框後面，數量一直顯示）：src/project-column.ts 在暫停專案的名稱後面加 `⏳ 暫停` 標籤；styles.css 讓 `status-pending` 列的年視圖色條（實心、虛線、超出期限都適用）與月視圖格子改成分類色斜線紋、約 0.6 不透明度，深淺主題都看得清楚。驗證：既有測試全數通過，另加一個測試確認暫停專案的列有標籤、進行中的沒有；畫面列入 3.4 手動驗收。

## 3. 文件與驗收

- [x] 3.1 文件（設計：版本與文件）：README 英文與中文說明暫停的專案預設隱藏、`顯示暫停（<n>）`、`編輯分類與狀態` 的狀態選單與改名行為（連結更新取決於 Obsidian 的「自動更新內部連結」設定）；CHANGELOG 0.5.0 英文與中文各加一段；openspec/LANGUAGE.md 的 `pending` 條目改成暫停並說明預設隱藏。驗證：重讀差異，中英一致。
- [x] 3.2 自動驗收：`npm test`、`npm run lint`（0 錯誤）、`npm run build` 通過，部署到本機 vault，依 AGENTS.md 的隱私檢查確認沒有命中。驗證：貼出各指令結果。
- [x] 3.3 文件補暫停列的標示（設計：暫停的專案藏在自己的勾選框後面，數量一直顯示）：README 與 CHANGELOG 0.5.0 的暫停說明改成「名稱後面有 `⏳ 暫停` 標籤、色條是斜線紋」。驗證：重讀差異，中英一致。
- [ ] 3.4 朱騏在 Obsidian 手動驗收：4 個 ⏳ 專案預設不見、控制列出現 `顯示暫停（4）`，勾起來顯示，名稱後面有 `⏳ 暫停` 標籤、色條是斜線紋；勾 `編輯分類與狀態` 後把一個專案改成暫停再改回進行中，檔名開頭符號正確、其他筆記的連結沒斷、手動分類還在；月視圖也套用同樣的過濾。驗證：朱騏在對話中確認。
