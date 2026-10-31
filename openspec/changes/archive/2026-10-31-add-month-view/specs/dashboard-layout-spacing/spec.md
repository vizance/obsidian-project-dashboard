## MODIFIED Requirements

### Requirement: 週欄寬度

In the year view, each week column header (`th.week`) and body cell (`td.week-cell`) SHALL have a fixed width of 32px (set via `width`, `min-width`, and `max-width`). This creates breathing space between weekly labels (W14, W15, W16, ...) and increases the chart's overall density to a comfortable reading level. The month view's week columns use their own classes (`th.month-week`, `td.month-cell`) and share the available width instead, so this fixed width does not apply to them.

#### Scenario: 週欄寬度套用

- **WHEN** 儀錶板以年視圖載入完成
- **THEN** 任一 `th.week` 的 computed `width` MUST 等於 `32px`
- **AND** 任一 `td.week-cell` 的 computed `width` MUST 等於 `32px`
- **AND** 53 個週欄總寬度 MUST 約等於 `53 × 32 = 1696px`（誤差 ≤ 5px，由 border / box-sizing 造成）

##### Example: W14-W18 視覺鬆開
- **GIVEN** 修改前 W14-W18 五個週欄總寬度為 `5 × 24 = 120px`
- **WHEN** 套用本次變更
- **THEN** W14-W18 五個週欄總寬度 MUST 變為 `5 × 32 = 160px`（增加 33%）
- **AND** 週標籤之間的視覺間距 MUST 明顯比修改前寬
