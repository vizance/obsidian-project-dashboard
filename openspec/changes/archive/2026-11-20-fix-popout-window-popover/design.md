## Context

`src/view.ts` 的 `registerWeekPopover` 在分頁打開時，把 document 層的 click 監聽與 window 層的 scroll 監聽（capture）掛在 `activeDocument`／`activeWindow` 上。浮窗本身已經會跟著分頁搬家：`positionWeekPopover` 每次定位前，會把浮窗元素搬到 `containerEl.ownerDocument.body`。但監聽沒有跟著搬，所以分頁在獨立視窗時，點擊與捲動都收不到。圖例拖拉（`registerLegendDrag`）與欄寬拖拉（`registerResizeHandle`）在拖拉開始時用 `activeDocument`，只有在獨立視窗剛好是作用中視窗時才對。快捷鍵用分頁自己的 `Scope`，不受影響。

## Goals / Non-Goals

**Goals:**

- 分頁在任何視窗裡，浮窗的打開與關閉、圖例拖拉、欄寬拖拉都照常運作。
- 分頁在視窗之間搬家後，監聽只跟著分頁現在所在的視窗。

**Non-Goals:**

- 不改浮窗內容、定位規則、關閉規則與任何編輯行為。
- 不改快捷鍵範圍。
- 不處理兩個儀表板分頁放在不同視窗時的其他差異。

## Decisions

### 監聽掛在分頁自己的 document 與 window，搬家時重新掛

新增一個小方法，例如 `bindWindowListeners(doc)`：

- 用 `addEventListener` 把原本的 click 處理掛到 `doc`、scroll 處理（capture）掛到 `doc.defaultView`，並記下解除函式。
- 再掛一次之前，先解除上一組監聽。

分頁打開時用 `this.containerEl.ownerDocument` 掛一次。`this.containerEl.onWindowMigrated((win) => ...)` 在分頁搬到別的視窗時呼叫：解除舊監聽、用 `win.document` 重新掛、關掉開著的浮窗，再把浮窗元素搬到新視窗的 body。`onWindowMigrated` 回傳的解除函式，以及最後一組監聽的解除，都用 `this.register(...)` 交給 view，分頁關閉時一起清掉。

處理器本身的內容完全不動，只換掛的位置。

替代方案一：每次點擊時動態判斷。document 層監聽只能掛在某一個 document 上，掛錯視窗就永遠收不到，所以不採用。

替代方案二：把 click 監聽改掛在 `contentEl`。點浮窗外面（例如筆記區）要關浮窗的規則就做不到，所以不採用。

### 圖例拖拉與欄寬拖拉用分頁自己的 document

兩個拖拉在 mousedown 時取 `this.containerEl.ownerDocument`，用它做 `elementFromPoint` 和掛 mousemove／mouseup。拖拉當下分頁一定在那個 document 裡，比 `activeDocument` 可靠。

## Implementation Contract

**行為：**

- 分頁在獨立視窗時，年視圖週格子、月視圖格子、「還沒排」都在那個視窗打開浮窗。點外面、捲動含錨點的元素、Escape 都照規則關閉。
- 圖例拖拉、欄寬拖拉在獨立視窗正常。
- 搬家時關掉開著的浮窗；之後只回應新視窗的點擊與捲動。
- 主視窗的行為完全不變。

**介面與資料形狀：** 沒有新的設定、偏好或外掛資料。`src/view.ts` 內部新增掛載與重新掛載監聽的方法，原本的 click／scroll 處理器邏輯照舊。

**失敗與錯誤處理：** `onWindowMigrated` 沒有觸發時（例如分頁沒搬家），行為與分頁打開時掛的那一組相同。不新增使用者看得到的訊息。

**驗收標準：**

- 既有測試全數通過，`npm run lint` 0 錯誤，`npm run build` 成功。
- 程式裡不再有用 `activeDocument`／`activeWindow` 掛 document 層或 window 層監聽的地方：`grep -n "registerDomEvent(activeDocument\|registerDomEvent(activeWindow\|activeDocument\." src/view.ts` 沒有結果。
- 朱騏手動驗收規格的三個情境。

**範圍內：** `src/view.ts` 的浮窗監聽、圖例拖拉、欄寬拖拉；CHANGELOG 0.5.0 的修正說明。

**範圍外：** Non-Goals 的所有項目。

## Risks / Trade-offs

- [搬家時沒有觸發 `onWindowMigrated`，監聽仍掛在舊視窗] → 手動驗收包含「搬過去」與「搬回來」兩個方向；`positionWeekPopover` 原本就會把浮窗搬到分頁所在的 body，作為第二道保險。
- [獨立視窗關掉後，監聽留在已關閉的視窗] → 搬家時一定先解除舊監聽；分頁關閉時由 `this.register` 清掉最後一組。
