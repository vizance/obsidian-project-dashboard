## 1. 修正

- [x] 1.1 浮窗監聽跟著分頁所在的視窗（Dashboard works the same in a pop-out window；設計：監聽掛在分頁自己的 document 與 window，搬家時重新掛）：src/view.ts 的 `registerWeekPopover` 改成把原本的 click 處理掛到 `containerEl.ownerDocument`、scroll 處理（capture）掛到它的 `defaultView`；用 `containerEl.onWindowMigrated` 在分頁搬到別的視窗時解除舊監聽、改掛到新視窗、關掉開著的浮窗、把浮窗元素搬到新視窗的 body；解除函式交給 `this.register`。處理器內容不變。驗證：`npm test` 全數通過、`npm run lint` 0 錯誤、`npm run build` 成功；`grep -n "registerDomEvent(activeDocument\|registerDomEvent(activeWindow" src/view.ts` 沒有結果。
- [x] 1.2 拖拉用分頁自己的 document（Dashboard works the same in a pop-out window；設計：圖例拖拉與欄寬拖拉用分頁自己的 document）：`registerLegendDrag` 與 `registerResizeHandle` 在 mousedown 時取 `containerEl.ownerDocument`，用它做 `elementFromPoint` 與掛、拆 mousemove／mouseup。驗證：`grep -n "activeDocument" src/view.ts` 沒有結果；既有測試全數通過。

## 2. 文件與驗收

- [x] 2.1 CHANGELOG 0.5.0 英文與中文各補一段：分頁拖到獨立視窗後點格子不會跳出浮窗的問題已修正，並說明原因（監聽掛在主視窗，現在跟著分頁所在的視窗）。驗證：重讀差異，中英一致。
- [ ] 2.2 自動驗收與部署：`npm test`、`npm run lint`、`npm run build` 通過，`npm run deploy` 部署到本機 vault，依 AGENTS.md 的隱私檢查確認沒有命中。驗證：貼出各指令結果。
- [ ] 2.3 朱騏在 Obsidian 手動驗收：分頁拖到獨立視窗後，年視圖週格子、月視圖格子、「還沒排」都能打開浮窗並編輯；點外面、捲動、Escape 會關閉；圖例拖拉與欄寬拖拉正常；搬回主視窗後一切照常，搬家時開著的浮窗會關掉。驗證：朱騏在對話中確認。
