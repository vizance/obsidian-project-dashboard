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
- **AND** 畫面上 MUST 顯示所有 `pending` 與 `active` 專案的色條

#### Scenario: 勾選後顯示 closed

- **WHEN** 使用者勾選「顯示已結案」
- **THEN** 所有 `done` 與 `cancelled` 專案的色條 MUST 出現在表格中
- **AND** 這些色條 MUST 套用灰階退場視覺
- **AND** `pending`、`active` 專案的色條 MUST 不受影響

##### Example: 切換前後的列數差異

- **GIVEN** 共 21 個專案：8 個 `pending` + 13 個 `active`，另有 7 個 `done`、0 個 `cancelled`
- **WHEN** 「顯示已結案」未勾選
- **THEN** 顯示 21 條色條（8 pending + 13 active）
- **WHEN** 「顯示已結案」勾選
- **THEN** 顯示 28 條色條（多出的 7 條為灰階）

---
### Requirement: 維持既有色條與互動行為

The status controls MUST NOT change any of the following: bar geometry (start/end calculation, z-index, continuity), color-by-category mapping for pending/active bars, Pin-by-category sort, light theme, today-column red highlight, monthly/quarterly/weekly divider rendering.

#### Scenario: 互動回歸驗證

- **WHEN** 套用本次變更後重新載入儀錶板
- **THEN** 點擊任一分類的 legend MUST 仍將該類專案排到最上方
- **AND** 跨多週的進行中專案色條 MUST 仍為單一連續色塊
- **AND** 今日週欄位 MUST 仍顯示 `rgba(239, 68, 68, 0.12)` 紅色淡底
- **AND** 月份/季度/週分隔線 MUST 仍以三層強度階層呈現
