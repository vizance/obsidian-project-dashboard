## MODIFIED Requirements

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
