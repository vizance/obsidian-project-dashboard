## Problem

把「專案總覽」分頁拖出 Obsidian 主視窗，它會變成一個獨立視窗。在這個獨立視窗裡，點年視圖的週格子、月視圖的格子或「還沒排」，都不會跳出浮窗，所以沒辦法編輯任務。開著的浮窗遇到捲動也不會自己關掉。

## Root Cause

`src/view.ts` 的 `registerWeekPopover` 在分頁打開時，把 document 的 click 監聽掛到 `activeDocument`，把 window 的 scroll 監聽掛到 `activeWindow`，兩個都是當下的主視窗。分頁之後搬到獨立視窗，點擊和捲動發生在另一個 document，主視窗的監聽收不到，浮窗就不會打開或關閉。

圖例拖拉、欄寬拖拉在拖拉時用 `activeDocument` 找滑鼠底下的元素、掛 mousemove／mouseup，同樣依賴「目前作用中的是哪個視窗」，不是分頁真正所在的視窗。

## Proposed Solution

- 浮窗的 click 與 scroll 監聽改掛在分頁自己所在的 document 與 window，也就是 `containerEl.ownerDocument` 與它的 `defaultView`。
- 用 Obsidian 的 `onWindowMigrated`，在分頁搬到別的視窗或搬回主視窗時：
  - 拆掉舊視窗上的監聽，掛到新視窗；
  - 關掉開著的浮窗；
  - 把浮窗元素搬到新視窗的 body。
- 圖例拖拉與欄寬拖拉改用分頁自己的 document。
- 規格新增一條：儀表板在獨立視窗裡的互動跟在主視窗一樣，浮窗出現在儀表板所在的視窗。
- 這個修正併進還沒發布的 0.5.0，CHANGELOG 0.5.0 補一段說明。

## Non-Goals

- 不改浮窗的內容、定位、關閉規則或任何編輯行為。
- 不處理同時開兩個儀表板分頁、分別放在不同視窗的版面差異（兩個分頁各自處理自己的視窗，行為照舊）。
- 不改快捷鍵的範圍規則（分頁自己的 Scope 在獨立視窗裡照樣作用）。

## Success Criteria

- 分頁在獨立視窗時，點年視圖的週格子、月視圖的格子、月視圖的「還沒排」，都會在那個視窗裡打開浮窗；同一格再點一次會關閉。
- 在獨立視窗裡點浮窗外面、捲動儀表板、按 Escape，浮窗會關閉，規則與主視窗相同。
- 圖例拖拉排序、專案欄拖拉寬度在獨立視窗裡正常運作。
- 分頁搬到獨立視窗、再搬回主視窗之後，兩邊都照常運作；搬家當下開著的浮窗會關掉。
- 主視窗裡的所有行為與現在完全相同，既有測試全數通過。

## Impact

- Affected specs: dashboard-obsidian-plugin（新增一條需求）
- Affected code:
  - Modified: src/view.ts, CHANGELOG.md
