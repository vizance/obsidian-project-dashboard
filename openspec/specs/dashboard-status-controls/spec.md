# dashboard-status-controls Specification

## Purpose

Define how a project's lifecycle status drives the "closed" visual treatment and the single toggle that shows or hides closed projects.

## Requirements

### Requirement: 狀態語義

每個專案帶有一個 **lifecycle status**，其值為 `pending`、`active`、`done`、`cancelled` 其中之一。UI 層 MAY 將 `done` 與 `cancelled` 一併視為派生的視覺類別 `closed`，僅用於渲染判斷，不改變底層的 `status` 欄位。

#### Scenario: UI 層派生 closed 視覺類別

- **WHEN** 前端渲染色條
- **THEN** 若專案 `status` 為 `done` 或 `cancelled`，該色條 MUST 被視為 `closed` 視覺類別

---
### Requirement: closed 色條視覺退場

Any bar belonging to the `closed` visual category SHALL be rendered with `filter: grayscale(100%)` AND `opacity: 0.35` (or visually equivalent CSS achieving full desaturation and ~35% opacity), making it visually subordinate to active/pending bars on the same chart.

#### Scenario: closed 色條轉為灰階

- **WHEN** 一個 `done` 或 `cancelled` 專案的色條被顯示
- **THEN** 該色條的 computed `filter` 屬性 MUST 包含 `grayscale(100%)`
- **AND** 該色條的 computed `opacity` MUST 等於 `0.35`（誤差 ≤ 0.02）

##### Example: 已完成專案色條

- **GIVEN** 專案 `P-20260427 範例：已完成的演講邀約`，status = `done`
- **WHEN** 在儀錶板中顯示其色條
- **THEN** 色條 MUST 為灰階（無原本的橘色 / 紫色 / 任何彩色相），且明顯比同列的 active 色條淡

---
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

---
### Requirement: 維持既有色條與互動行為

The status controls MUST NOT change any of the following: bar geometry (start/end calculation, z-index, continuity), color-by-category mapping for pending/active bars, Pin-by-category sort, light theme, today-column red highlight, monthly/quarterly/weekly divider rendering.

#### Scenario: 互動回歸驗證

- **WHEN** 套用本次變更後重新載入儀錶板
- **THEN** 點擊任一分類的 legend MUST 仍將該類專案排到最上方
- **AND** 跨多週的進行中專案色條 MUST 仍為單一連續色塊
- **AND** 今日週欄位 MUST 仍顯示 `rgba(239, 68, 68, 0.12)` 紅色淡底
- **AND** 月份/季度/週分隔線 MUST 仍以三層強度階層呈現

---
### Requirement: Paused projects are hidden behind their own toggle

A project whose status is `pending` (its filename starts with `⏳`) is a paused project. Paused projects SHALL be hidden from the year view and the month view by default. The controls row SHALL show, next to `顯示已結案`, a checkbox labelled `顯示暫停（<n>）`, where `<n>` is the number of paused projects that would be shown if the checkbox were checked (projects in the project folder, not skipped by `Projects to skip`, and with a start and end date); the checkbox SHALL NOT be shown when `<n>` is 0, and SHALL be unchecked whenever the dashboard tab opens. While it is checked, paused projects SHALL be shown in their usual place and order, and every paused row SHALL read as paused at a glance: the label `⏳ 暫停` SHALL follow the project name, and the row's year-view bars and month-view cells SHALL be drawn with diagonal stripes in the category color at reduced opacity (about 0.6), so a paused row looks neither active (solid color) nor closed (grey). The count SHALL update on every re-scan.

#### Scenario: Paused projects are hidden with a count

- **GIVEN** the project folder holds `⏳ P-20260601 範例專案 B` and `⏳ P-20260701 範例專案 C`, both with start and end dates, and 13 active projects
- **WHEN** the dashboard opens
- **THEN** 13 project rows MUST be shown
- **AND** the controls row MUST show an unchecked `顯示暫停（2）`
- **WHEN** the user checks `顯示暫停（2）`
- **THEN** 15 rows MUST be shown
- **AND** each of the two paused rows MUST show the label `⏳ 暫停` after its name and striped bars

#### Scenario: No paused projects, no checkbox

- **GIVEN** no project's filename starts with `⏳`
- **WHEN** the dashboard renders
- **THEN** no `顯示暫停` checkbox MUST be shown
