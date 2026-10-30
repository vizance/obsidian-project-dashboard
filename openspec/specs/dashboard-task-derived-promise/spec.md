# dashboard-task-derived-promise Specification

## Purpose

Derive each project's promised and overflow end dates, and its occupied weeks, from the task dates found in its note, so the gantt bar's solid/dashed split reflects actual planned work instead of a hardcoded list.

## Requirements

### Requirement: 掃描 markdown 任務日期

The scanner SHALL parse the body of each project markdown file and collect every ISO date occurring after a `📅 ` or `✅ ` token. The collected dates SHALL be exposed per project for promise computation. Dates SHALL match the literal regex `(📅|✅)\s+(\d{4}-\d{2}-\d{2})`; other date notations SHALL NOT be parsed.

#### Scenario: 抓取任務內 ISO 日期

- **GIVEN** 一份專案筆記內含下列行：`- [x] 撰寫逐字稿 📅 2026-01-30 ✅ 2026-01-26`
- **WHEN** scanner 處理該檔案
- **THEN** 該檔案的任務日期集合 MUST 包含 `2026-01-30` 與 `2026-01-26`

#### Scenario: 忽略不符合語法的日期

- **GIVEN** 一份專案筆記含 `due: 2026-05-01` 與 `預計 2026/05/02 完成` 兩行
- **WHEN** scanner 處理該檔案
- **THEN** scanner MUST NOT 把 `2026-05-01` 或 `2026/05/02` 加入任務日期集合（因為缺少 `📅` 或 `✅` 前綴、或日期格式非 ISO `YYYY-MM-DD`）

---
### Requirement: 計算 promised_end

For each project, the scanner SHALL output a `promised_end` field of the project record equal to the maximum date in that project's task-date set, or `null` if the set is empty. `promised_end` SHALL be in ISO `YYYY-MM-DD` format when not null.

#### Scenario: 多筆任務取最晚

- **GIVEN** 某專案任務日期集合為 `{2026-01-30, 2026-02-04, 2026-01-26}`
- **WHEN** scanner 輸出該專案資料
- **THEN** 該專案的 `promised_end` MUST 等於 `2026-02-04`

#### Scenario: 無任務日期則為 null

- **GIVEN** 某專案筆記內文沒有任何 `📅` 或 `✅` 後接 ISO 日期
- **WHEN** scanner 輸出該專案資料
- **THEN** 該專案的 `promised_end` MUST 為 JSON `null`

---
### Requirement: 實線段與虛線段分段渲染

The dashboard SHALL render each visible project's bar as up to two segments based on `promised_end`:

- A **solid segment** SHALL be drawn from `start` to `min(promised_end, end)` when `promised_end` exists AND `promised_end >= start`.
- A **dashed segment** SHALL be drawn from `max(start, promised_end)` to `end` when `end > promised_end` (or when `promised_end` is `null`, the dashed segment spans the entire `start → end`).
- When `promised_end >= end`, the bar SHALL be rendered as a single solid segment from `start` to `end` (no dashed extension).

#### Scenario: 標準案例—1 到 5 月實線、6 到 12 月虛線

- **GIVEN** 某專案 `start = 2026-01-01`、`end = 2026-12-31`、`promised_end = 2026-05-30`
- **WHEN** 前端渲染此專案
- **THEN** MUST 畫出實線段從 2026-01-01 到 2026-05-30
- **AND** MUST 畫出虛線段從 2026-05-30 到 2026-12-31

##### Example: 1-on-1 訂閱制專案
- **GIVEN** 範例專案：`start = 2025-09-24`、`end = 2026-12-31`、任務日期僅出現在 2026-01 至 2026-05 之間且最晚為 `2026-05-21`
- **WHEN** 前端渲染此專案
- **THEN** MUST 畫出實線段 2025-09-24 → 2026-05-21
- **AND** MUST 畫出虛線段 2026-05-21 → 2026-12-31

#### Scenario: 無任務日期則整條虛線

- **GIVEN** 某專案 `start = 2026-04-30`、`end = 2026-12-13`、`promised_end = null`
- **WHEN** 前端渲染此專案
- **THEN** MUST 整條色條為虛線
- **AND** MUST NOT 出現任何實線段

#### Scenario: promised_end 等於或超過 end 時不畫虛線

- **GIVEN** 某專案 `start = 2026-03-01`、`end = 2026-04-30`、`promised_end = 2026-04-30`（或更晚）
- **WHEN** 前端渲染此專案
- **THEN** MUST 整條為實線
- **AND** MUST NOT 出現虛線段

---
### Requirement: 已結案專案不延伸虛線

When a project's status is `done` or `cancelled`, the bar SHALL render only a single solid (grayscale-tinted) segment ending at `min(promised_end, end)` or `end` if `promised_end` is null. The dashed extension SHALL NOT be drawn for closed projects, because they no longer have future planned work to express.

#### Scenario: 已完成專案末端不留虛線

- **GIVEN** 一個 `done` 狀態的專案 `start = 2026-01-01`、`end = 2026-01-31`、`promised_end = 2026-01-26`
- **WHEN** 前端在勾選「顯示已結案」狀態下渲染此專案
- **THEN** MUST 畫出實線段（套灰階退場）從 2026-01-01 到 2026-01-26
- **AND** MUST NOT 畫出任何虛線段
- **AND** 整條 bar 的視覺長度 MUST 對應到 promised_end 而非 end

---
### Requirement: 維持既有色條與互動行為

This change MUST NOT alter: bar start-date calculation, color-by-category mapping, Pin-by-category sort, light theme, today red column highlight, monthly/quarterly/weekly divider rendering, single「顯示已結案」checkbox control, closed grayscale fade.

#### Scenario: 互動回歸驗證

- **WHEN** 套用本次變更後重新載入儀錶板
- **THEN** 點擊任一分類的 legend MUST 仍將該類專案排到最上方
- **AND** 跨多週的進行中專案色條 MUST 顯示完整一條 bar（其中是否含虛線段由其任務日期決定）
- **AND** 今日週欄位 MUST 顯示 `rgba(239, 68, 68, 0.12)` 紅色淡底
- **AND** 「顯示已結案」勾選切換 MUST 仍正確顯示/隱藏 done + cancelled 專案
- **AND** done/cancelled 色條 MUST 仍套用 grayscale + opacity 0.35 視覺退場
- **AND** 月份/季度/週三層分隔線 MUST 仍呈現

---
### Requirement: Compute overflow_end from task dates beyond end

The scanner SHALL output a new `overflow_end` field of each project record. `overflow_end` SHALL equal `max(task_dates)` when ALL of the following hold: the project's `task_dates` set is non-empty, the project's `end` is not null, `max(task_dates) > end`, and the project's `status` is neither `done` nor `cancelled`. Otherwise `overflow_end` SHALL be `null`. When non-null, `overflow_end` SHALL be in ISO `YYYY-MM-DD` format.

#### Scenario: Task date past end on active project

- **GIVEN** an active project with `end = 2026-05-30` and a note containing `📅 2026-07-15`
- **WHEN** the scanner outputs the project's data
- **THEN** `overflow_end` MUST equal `"2026-07-15"`
- **AND** `end` MUST remain `"2026-05-30"`
- **AND** `promised_end` MUST equal `"2026-07-15"`

#### Scenario: All task dates within end

- **GIVEN** an active project with `end = 2026-12-31` and all task dates ≤ `2026-12-31`
- **WHEN** the scanner outputs the project's data
- **THEN** `overflow_end` MUST be JSON `null`

#### Scenario: Closed project suppresses overflow

- **GIVEN** a project with `status = done`, `end = 2026-01-31`, and a note containing `📅 2026-03-01`
- **WHEN** the scanner outputs the project's data
- **THEN** `overflow_end` MUST be JSON `null`

#### Scenario: Missing end suppresses overflow

- **GIVEN** a project with `end = null` (frontmatter and filename provide no end date)
- **WHEN** the scanner outputs the project's data
- **THEN** `overflow_end` MUST be JSON `null`

---
### Requirement: Existing fields preserved

The introduction of `overflow_end` SHALL NOT change the type, value, or semantics of existing fields `start`, `end`, `promised_end`, or `status`. `end` SHALL continue to be derived from frontmatter (`預計結束日期` / `實際結束日期`), then filename, then `DEFAULT_END`, in that order — the scanner MUST NOT rewrite `end` based on task dates.

#### Scenario: end is not extended by task dates

- **GIVEN** an active project whose frontmatter declares `預計結束日期: 2026-05-30` and whose note contains `📅 2026-07-15`
- **WHEN** the scanner outputs the project's data
- **THEN** `end` MUST equal `"2026-05-30"`
- **AND** `overflow_end` MUST equal `"2026-07-15"`

---
### Requirement: Output occupied_weeks per project

The scanner SHALL output a new `occupied_weeks` field of each project record. The value SHALL be a deduplicated, ascending-sorted list of ISO week labels in `YYYY-Www` format (where `ww` is zero-padded `01`–`53`), computed from the project's task dates as follows:

- For each task date `d` in the project's `task_dates` set:
  - If `d.weekday()` is Saturday and the `Saturday tasks count for next week` setting (`saturdayCountsAsNextWeek`) is on → add the ISO week label of `d + 2 days` (i.e., the Monday of the following ISO week; `d + 1 day` would still fall in the same ISO week because ISO weeks end on Sunday).
  - Otherwise → add the ISO week label of `d` (year and week number per ISO 8601).

Friday dates SHALL always occupy their own ISO week, identical to Monday–Thursday and Sunday. There is NO weekday that is excluded from occupation; Saturday is the only weekday whose contribution can be shifted, and only when the setting is on. The setting is off by default.

When the project has no task dates, `occupied_weeks` SHALL be `[]`.

#### Scenario: Mon-Thu task occupies current week

- **GIVEN** a project note containing `📅 2026-01-12` (Monday)
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W03"`

#### Scenario: Saturday task bumps to next week when the setting is on

- **GIVEN** a project note containing `📅 2026-02-21` (Saturday, ISO W8) and `Saturday tasks count for next week` is on
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W09"` and MUST NOT contain `"2026-W08"`

#### Scenario: Saturday task stays in its week when the setting is off

- **GIVEN** a project note containing `📅 2026-02-21` (Saturday, ISO W8) and `Saturday tasks count for next week` is off
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W08"` and MUST NOT contain `"2026-W09"`

#### Scenario: Friday task occupies its own week

- **GIVEN** a project note containing `📅 2026-06-19` (Friday, ISO W25)
- **WHEN** the scanner processes the file with the setting on or off
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W25"`
- **AND** the week label MUST NOT be shifted to any other week

#### Scenario: Sunday task occupies current week

- **GIVEN** a project note containing `📅 2026-01-11` (Sunday, ISO W2)
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W02"`

#### Scenario: Multiple tasks in same week deduplicated

- **GIVEN** a project note containing both `📅 2026-01-12` (Mon) and `📅 2026-01-14` (Wed), both in ISO W3
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain exactly one `"2026-W03"` entry (no duplicates)

#### Scenario: No task dates yields empty list

- **GIVEN** a project note with zero `📅` or `✅` task date occurrences
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST equal `[]`

##### Example: Comprehensive multi-date project

- **GIVEN** a project note containing `📅 2026-01-12` (Mon), `📅 2026-02-21` (Sat), `📅 2026-03-13` (Fri), `📅 2026-05-15` (Fri)
- **WHEN** the scanner processes the file
- **THEN** `occupied_weeks` MUST equal `["2026-W03", "2026-W09", "2026-W11", "2026-W20"]` with the Saturday setting on, and `["2026-W03", "2026-W08", "2026-W11", "2026-W20"]` with it off
- **AND** `promised_end` MUST equal `"2026-05-15"` either way

##### Example: week of a single date

| Date | Setting off | Setting on |
| ---- | ----------- | ---------- |
| `2026-10-30` (Fri) | `2026-W44` | `2026-W44` |
| `2026-10-31` (Sat) | `2026-W44` | `2026-W45` |
| `2026-11-01` (Sun) | `2026-W44` | `2026-W44` |
| `2027-01-02` (Sat) | `2026-W53` | `2027-W01` |

---
### Requirement: Output raw task_dates per project

The scanner SHALL output a new `task_dates` field of each project record. The value SHALL be a deduplicated, ascending-sorted list of ISO date strings (`YYYY-MM-DD`) — the same set used to compute `promised_end`, `overflow_end`, and `occupied_weeks`. When the project has no task dates, `task_dates` SHALL be `[]`.

#### Scenario: task_dates exposes raw dates including Friday

- **GIVEN** a project note containing `📅 2026-01-12`, `📅 2026-02-21`, `📅 2026-03-13`
- **WHEN** the scanner processes the file
- **THEN** `task_dates` MUST equal `["2026-01-12", "2026-02-21", "2026-03-13"]` (sorted ascending, no deduplication needed since all distinct)

#### Scenario: Duplicates in note collapse in output

- **GIVEN** a project note where `📅 2026-01-12` appears twice (e.g., in two different task lines)
- **WHEN** the scanner processes the file
- **THEN** `task_dates` MUST contain exactly one `"2026-01-12"` entry

---
### Requirement: Existing date fields preserved under per-week model

Introducing `occupied_weeks` and `task_dates` SHALL NOT change the value, type, or computation of `start`, `end`, `promised_end`, `overflow_end`, or `status`. In particular, `promised_end` SHALL continue to equal `max(task_dates)` regardless of weekday and regardless of the `Saturday tasks count for next week` setting. A Friday task date SHALL count toward `promised_end` and SHALL occupy its own ISO week. A Saturday task date SHALL count toward `promised_end` with its raw date, even when the week it occupies is shifted to the following ISO week.

#### Scenario: Friday task contributes to promised_end and occupies its own week

- **GIVEN** a project whose only task date is `📅 2026-05-15` (Friday, ISO W20)
- **WHEN** the scanner processes the file
- **THEN** `promised_end` MUST equal `"2026-05-15"`
- **AND** `occupied_weeks` MUST equal `["2026-W20"]`

#### Scenario: Saturday task contributes raw date to promised_end (no bump)

- **GIVEN** a project whose latest task date is `📅 2026-02-21` (Saturday) and `Saturday tasks count for next week` is on
- **WHEN** the scanner processes the file
- **THEN** `promised_end` MUST equal `"2026-02-21"` (the raw date, NOT the bumped following-week date)
- **AND** `occupied_weeks` MUST contain `"2026-W09"` (the bumped week)
