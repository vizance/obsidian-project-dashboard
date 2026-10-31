# dashboard-resizable-proj-col Specification

## Purpose

Let the user drag-resize the left project-name column and persist the chosen width across sessions.

## Requirements

### Requirement: 拖拉手把與游標提示

The dashboard SHALL render a 4px-wide vertical resize handle positioned at the right edge of the left project column header (`th.proj-col`). When the cursor hovers over the handle, the cursor style SHALL change to `col-resize` to signal that dragging is possible.

#### Scenario: 滑鼠移過 handle 時顯示 col-resize 游標

- **WHEN** 使用者把滑鼠移到左側專案欄右邊緣的拖拉手把上
- **THEN** 滑鼠 cursor MUST 變為 `col-resize` 樣式
- **AND** 該手把 MUST 為一個可見元素（即使視覺上極窄），其 width MUST 約為 4px

---
### Requirement: 拖拉即時更新寬度

When the user presses mouse button on the resize handle and drags horizontally, the left project column width SHALL update in real time during `mousemove`. Releasing the mouse button SHALL commit the final width.

#### Scenario: 拖拉時左欄寬度跟著變動

- **GIVEN** 左欄目前寬度為 280px、resize handle 位於 x = 280px 附近
- **WHEN** 使用者在 handle 上按下滑鼠，把游標往左拖到專案欄左邊緣後方的相對位移 -80px 處（即新寬度約 200px）
- **THEN** 左欄寬度 MUST 即時更新為約 200px
- **AND** 甘特圖區域（53 個週欄）MUST 跟著向左挪移（整張表總寬縮減約 80px）

---
### Requirement: 寬度寫入 localStorage 並在下次載入套用

When the user releases the mouse after a drag, the new width SHALL be persisted to `localStorage` under the key `dashboard.projColWidth` as a stringified integer (pixels). On subsequent page loads, the dashboard SHALL read this key and apply the stored width before initial render. When the key is absent or contains an invalid value, the dashboard SHALL use the default width of 280px.

#### Scenario: 拖完後寬度寫入 localStorage

- **WHEN** 使用者完成一次拖拉（mouseup）並把左欄寬度設為 220px
- **THEN** `localStorage.getItem('dashboard.projColWidth')` MUST 回傳字串 `'220'`

#### Scenario: 重新整理頁面後套用儲存寬度

- **GIVEN** `localStorage.getItem('dashboard.projColWidth')` 為字串 `'220'`
- **WHEN** 使用者重新整理儀錶板頁面
- **THEN** 載入後左欄的 computed `width` MUST 等於 `220px`（誤差 ≤ 1px）

#### Scenario: 無儲存或損毀資料時使用預設值

- **GIVEN** `localStorage.getItem('dashboard.projColWidth')` 為 `null` 或非數字字串（例如 `'abc'`）
- **WHEN** 使用者載入儀錶板
- **THEN** 左欄寬度 MUST 為預設值 `280px`

---
### Requirement: 拖拉範圍限制

The left column width SHALL be clamped to the range [120, 600] pixels (inclusive). Drag movements that would set the width below 120px SHALL clamp at 120px; movements above 600px SHALL clamp at 600px. Values stored in `localStorage` outside this range SHALL be clamped on load before being applied.

#### Scenario: 往左拖超出最小寬度時夾到 120px

- **GIVEN** 左欄目前寬度為 150px
- **WHEN** 使用者把滑鼠往左拖動足以讓計算寬度變為 80px
- **THEN** 實際套用的左欄寬度 MUST 為 `120px`（不可低於下限）

#### Scenario: 往右拖超出最大寬度時夾到 600px

- **GIVEN** 左欄目前寬度為 550px
- **WHEN** 使用者把滑鼠往右拖動足以讓計算寬度變為 800px
- **THEN** 實際套用的左欄寬度 MUST 為 `600px`（不可超過上限）

#### Scenario: localStorage 含超出範圍值時載入也夾到邊界

- **GIVEN** `localStorage.getItem('dashboard.projColWidth')` 為字串 `'50'`
- **WHEN** 使用者載入儀錶板
- **THEN** 套用的左欄寬度 MUST 為 `120px`（夾到下限）

---
### Requirement: 甘特圖區域不受影響

In the year view, the chart area (week columns, bars, dividers) MUST remain visually and dimensionally unchanged by left-column resize: each week column SHALL stay at 32px width, the 53-column total SHALL stay at 1696px, bar geometry (start/end/promised_end), solid/dashed segments, closed grayscale fade, monthly/quarterly/weekly dividers, today red highlight, and Pin / sort controls SHALL all behave identically to before this change. In the month view, resizing the left column SHALL change only the width that the month's week columns share.

#### Scenario: 拖拉左欄不改變週欄寬度

- **GIVEN** 拖拉前任一週欄 width 為 32px
- **WHEN** 使用者把左欄從 280px 拖到 200px
- **THEN** 任一週欄 width MUST 仍為 32px
- **AND** 53 週總寬 MUST 仍為 1696px（誤差 ≤ 5px）

#### Scenario: 互動回歸驗證

- **WHEN** 套用本次變更後重新載入儀錶板並執行一次拖拉
- **THEN** 跨多週進行中專案色條 MUST 仍呈現 solid + dashed 分段
- **AND** 今日週欄位 MUST 仍顯示 `rgba(239, 68, 68, 0.12)` 紅色淡底
- **AND** 「顯示已結案」勾選 MUST 仍正確顯示/隱藏 done/cancelled
- **AND** Legend 釘選與類別順序 MUST 仍正確運作
- **AND** done/cancelled 色條 MUST 仍套用 grayscale + opacity 0.35
- **AND** 三層分隔線 MUST 仍呈現
