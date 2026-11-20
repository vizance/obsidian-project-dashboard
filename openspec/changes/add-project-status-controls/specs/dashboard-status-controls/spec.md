## ADDED Requirements

### Requirement: Paused projects are hidden behind their own toggle

A project whose status is `pending` (its filename starts with `⏳`) is a paused project. Paused projects SHALL be hidden from the year view and the month view by default. The controls row SHALL show, next to `顯示已結案`, a checkbox labelled `顯示暫停（<n>）`, where `<n>` is the number of paused projects that would be shown if the checkbox were checked (projects in the project folder, not skipped by `Projects to skip`, and with a start and end date); the checkbox SHALL NOT be shown when `<n>` is 0, and SHALL be unchecked whenever the dashboard tab opens. While it is checked, paused projects SHALL be shown in their usual place and order, with their rows drawn at reduced opacity (about 0.6) but keeping their category colors, so they look neither active nor closed. The count SHALL update on every re-scan.

#### Scenario: Paused projects are hidden with a count

- **GIVEN** the project folder holds `⏳ P-20260601 範例專案 B` and `⏳ P-20260701 範例專案 C`, both with start and end dates, and 13 active projects
- **WHEN** the dashboard opens
- **THEN** 13 project rows MUST be shown
- **AND** the controls row MUST show an unchecked `顯示暫停（2）`
- **WHEN** the user checks `顯示暫停（2）`
- **THEN** 15 rows MUST be shown, the two paused ones at reduced opacity

#### Scenario: No paused projects, no checkbox

- **GIVEN** no project's filename starts with `⏳`
- **WHEN** the dashboard renders
- **THEN** no `顯示暫停` checkbox MUST be shown

## MODIFIED Requirements

### Requirement: 單一 closed 切換控制

The dashboard SHALL provide exactly one user-visible toggle labeled「顯示已結案」(or English equivalent "Show closed") controlling whether `closed` bars are rendered. This control SHALL default to **off** (hidden) on initial load.

#### Scenario: 預設關閉，現役視圖乾淨

- **WHEN** 使用者首次開啟儀錶板
- **THEN** 「顯示已結案」checkbox MUST 為未勾選狀態
- **AND** 畫面上 MUST NOT 出現任何 `done` 或 `cancelled` 專案的色條
- **AND** 畫面上 MUST 顯示所有 `active` 專案的色條
- **AND** `pending` 專案依「Paused projects are hidden behind their own toggle」顯示或隱藏

#### Scenario: 勾選後顯示 closed

- **WHEN** 使用者勾選「顯示已結案」
- **THEN** 所有 `done` 與 `cancelled` 專案的色條 MUST 出現在表格中
- **AND** 這些色條 MUST 套用灰階退場視覺
- **AND** `pending`、`active` 專案的顯示 MUST 不受影響

##### Example: 切換前後的列數差異

- **GIVEN** 共 28 個專案：8 個 `pending`、13 個 `active`、7 個 `done`、0 個 `cancelled`，「顯示暫停」未勾選
- **WHEN** 「顯示已結案」未勾選
- **THEN** 顯示 13 列（13 active）
- **WHEN** 「顯示已結案」勾選
- **THEN** 顯示 20 列（多出的 7 列為灰階）

