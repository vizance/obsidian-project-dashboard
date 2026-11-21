## 1. 鎖定驗收

- [x] 1.1 先寫測試（Settings tab；設計：篩選與排序放在純函式、清單元件掛在原本的文字欄位上、測試替身）：由一段只寫測試的 Codex 對話新增 tests/folder-suggest.test.ts，涵蓋 `folderSuggestions` 排除 `/` 與空字串、空查詢回傳全部、不分大小寫的篩選（情境「Typing narrows the folder list」）、照路徑排序（情境「Clicking the folder field lists every folder」的順序 `Archive`、`Projects`、`Work`、`Work/Projects`），以及 `ProjectFolderSuggest` 剛取得焦點給全部、`beforeinput` 之後用欄位文字篩選、`blur` 後重設、`selectSuggestion` 會填值、關閉並呼叫 `onPick`；在 tests/settings-tab.test.ts 加欄位說明的新文字與情境「Picking a folder saves it」（存進 `projectFolder`、`Can't find this folder.` 消失）；tests/stubs/obsidian.ts 加最小的 `AbstractInputSuggest` 與 vault 的 `getAllFolders`。主代理確認後鎖定（記下雜湊）。驗證：在目前的程式上執行，新測試因為 src/folder-suggest.ts 不存在、說明文字還是舊的而失敗，既有測試仍通過。

## 2. 實作

- [x] 2.1 資料夾清單（Settings tab；設計：篩選與排序放在純函式、清單元件掛在原本的文字欄位上）：新增 src/folder-suggest.ts 的 `folderSuggestions` 與 `ProjectFolderSuggest`；src/settings-tab.ts 的 `buildProjectNotesSection` 在 `Project folder` 欄位上建立 `ProjectFolderSuggest`，`onPick` 做的事與欄位的 `onChange` 相同（`patch({ projectFolder })` 與 `updateFolderHint`），並把欄位說明改成 `The folder where your project notes live. Only notes right inside this folder are used. Notes in folders inside it are skipped. Tap or click the box to pick a folder from a list.`。驗證：1.1 鎖定的測試全部通過，既有測試全部通過，`npm run lint` 與 `npm run build` 通過。

## 3. 文件

- [x] 3.1 README、details 與更新紀錄（Settings tab）：README.md 與 README.zh-TW.md 的第一次設定步驟改成「點 `Project folder`，從清單選放專案筆記的資料夾，也可以自己打」；docs/details.md 與 docs/details.zh-TW.md 的設定段落補上清單的規則（點下去看全部、打字篩選、不列最上層）；CHANGELOG.md 的 0.6.0 段落加一條英文與中文說明。驗證：重讀差異，兩份 README 的段落與圖片仍一致，設定頁文字與規格相同。

## 4. 驗收

- [ ] 4.1 朱騏實測：在電腦與手機上各點一次 `Project folder`，看到資料夾清單、打字會縮小、點一個之後儀表板換成那個資料夾的專案。驗證：朱騏在對話中確認；點下去清單沒有自己打開時，依設計的風險處理改成在取得焦點時開啟清單，並補測試。
