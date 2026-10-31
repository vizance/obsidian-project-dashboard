# dashboard-layout-spacing Specification

## Purpose

Define the dashboard's spacing details — project-column padding, row heights, and related layout measurements — so the chart reads cleanly at a glance.

## Requirements

### Requirement: 左側專案欄內邊距

The left-most column cells displaying project names (`td.proj-cell`) SHALL apply padding `8px 16px` (vertical 8px, horizontal 16px). This ensures the project name does not visually touch either edge of the cell.

#### Scenario: proj-cell padding 套用

- **WHEN** 儀錶板載入完成
- **THEN** 任一 `td.proj-cell` 的 computed `padding` MUST 等於 `8px 16px`（vertical 8px, horizontal 16px）
- **AND** 該格的左右兩側 MUST 各有至少 16px 的內邊距

---
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

---
### Requirement: 維持既有色條與互動行為

This spacing change MUST NOT alter: bar geometry calculation, bar continuity across columns (no new gaps), color mappings, Pin-by-category sort, light theme, today red column highlight, monthly/quarterly/weekly divider strength hierarchy, solid/dashed segment split, closed grayscale fade, single「顯示已結案」checkbox.

#### Scenario: 互動回歸驗證

- **WHEN** 套用本次變更後重新載入儀錶板
- **THEN** 點擊「企業內訓」legend MUST 仍將該類專案排到最上方
- **AND** 跨多週進行中專案色條 MUST 仍呈現 solid + dashed 分段、無視覺斷裂
- **AND** 今日週欄位 MUST 仍顯示 `rgba(239, 68, 68, 0.12)` 紅色淡底
- **AND** 「顯示已結案」勾選切換 MUST 仍正確運作
- **AND** done / cancelled 色條 MUST 仍套用 grayscale + opacity 0.35
- **AND** 季 / 月 / 週三層分隔線 MUST 仍呈現
