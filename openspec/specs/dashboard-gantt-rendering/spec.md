# dashboard-gantt-rendering Specification

## Purpose

Render each project's gantt bar as a single visually continuous block across the weeks it spans, with month/quarter dividers drawn beneath it rather than cutting through it.

## Requirements

### Requirement: 色條視覺連續性

甘特圖中代表單一專案的色條 SHALL 從專案開始日期所在的週欄位起，連續延伸到專案預計結束日期所在的週欄位止，呈現為一條無縫的色塊；不論該專案跨越多少週、是否跨月、是否跨季，色條中間 SHALL NOT 出現任何空白縫隙、深色細線或視覺斷裂。

#### Scenario: 跨多月專案的色條完整連續

- **WHEN** 一個專案的起訖日期為 2026-04-13 ~ 2026-12-13（跨 4 月到 12 月）
- **THEN** 對應色條從 W15 一路延伸到 W50，中間每一週的儲存格上方都被色塊覆蓋
- **AND** 色條表面 SHALL NOT 有任何縱向細線、淡色縫隙或亮度落差

##### Example: 跨多月專案視覺檢查
- **GIVEN** 專案 `P-20260413 ~ 1213 範例：家庭生活專案`，起訖 `2026-04-13` 到 `2026-12-13`
- **WHEN** 使用者開啟儀錶板並肉眼檢查該專案所在列
- **THEN** 從 W15 到 W50 的色塊 MUST 為單一連續色塊
- **AND** 4 月與 5 月、6 月與 7 月、9 月與 10 月（季度交界）等位置 MUST NOT 有可見的切線

---
### Requirement: 月份與季度分隔線不切過色條

月份交界與季度交界 SHALL 仍以可見的視覺方式呈現以維持分組辨識度，但這些分隔線 MUST NOT 被繪製在色條之上，且 MUST NOT 影響色條的連續視覺。

#### Scenario: 分隔線繪製在色條下層

- **WHEN** 月份交界或季度交界的週欄位上方剛好有專案色條
- **THEN** 該分隔線 MUST 被色條完整覆蓋，使用者看到的是不被切斷的色條
- **AND** 該分隔線在「沒有色條覆蓋的列」（例如表頭、空白行）依然可見

---
### Requirement: 表格佈局不造成色條寬度誤差

色條的寬度 SHALL 以「跨越的週數 × 單一週欄位寬度」精確對齊，不因表格邊框、儲存格 padding、border-collapse 模式或 sticky 欄位而產生 1 像素以上的位移或縫隙。

#### Scenario: 每一格實際寬度一致

- **WHEN** 表格渲染完成
- **THEN** 每一個週欄位（`th.week` 與對應的 `td.week-cell`）的實際渲染寬度 MUST 一致
- **AND** 月份起始格（`.m-start`）與季度起始格（`.q-start`）的邊框 MUST NOT 佔據儲存格內容的可繪製寬度

---
### Requirement: 修改不破壞既有功能

實作色條連續性修正時 MUST NOT 改變以下既有功能的行為：色條起訖計算、配色映射、虛線（未確定專案）、淡化（已完成/取消專案）、Pin 類別排序、亮色版主題、「今天」紅色高亮欄位、篩選勾選框。

#### Scenario: 既有功能回歸驗證

- **WHEN** 修正完成後重新載入儀錶板
- **THEN** 所有專案的起訖位置 MUST 與修正前一致
- **AND** 點擊「企業內訓」圖例 MUST 仍將該類專案排到最上方
- **AND** 「顯示已完成」勾選框切換 MUST 仍正確顯示或隱藏已完成專案
- **AND** 今日週欄位 MUST 仍顯示紅色淡底高亮

---
### Requirement: Render overflow segment when overflow_end is present

When a project's `overflow_end` is non-null, the dashboard SHALL render an additional **overflow segment** beyond the existing solid and dashed segments. The overflow segment SHALL:

- Span from `end` to `overflow_end`.
- Be drawn as a solid (non-dashed) fill.
- Use a warning-style color (a saturated red distinct from any category color) instead of the project's category color, so that scope creep is visually distinguishable at a glance.
- Be drawn in addition to — not in place of — the existing solid and dashed segments described in spec `dashboard-task-derived-promise`. When `overflow_end` is non-null, `promised_end` always equals `overflow_end` (because `promised_end = max(task_dates)` and `overflow_end = max(task_dates)` in that case), so the dashed segment from `max(start, promised_end) → end` MAY collapse to zero width; this is acceptable.

When `overflow_end` is `null`, the dashboard MUST NOT render any overflow segment, and rendering MUST be identical to the pre-existing two-segment behavior.

#### Scenario: Overflow segment rendered past end

- **GIVEN** an active project with `start = 2026-01-01`, `end = 2026-05-30`, `promised_end = 2026-07-15`, `overflow_end = 2026-07-15`
- **WHEN** the frontend renders this project
- **THEN** a solid segment MUST be drawn from `2026-01-01` to `2026-05-30` using the project's category color
- **AND** a solid warning-colored segment MUST be drawn from `2026-05-30` to `2026-07-15`
- **AND** no dashed segment MUST be drawn (because `promised_end >= end`, the dashed range collapses)

#### Scenario: No overflow_end means no overflow segment

- **GIVEN** an active project with `overflow_end = null`
- **WHEN** the frontend renders this project
- **THEN** the frontend MUST NOT draw a warning-colored segment
- **AND** the bar visual MUST be identical in segment count and colors to the prior two-segment rendering

#### Scenario: Closed projects never show overflow

- **GIVEN** a project with `status = done`, `end = 2026-01-31`, and a note containing a `📅 2026-03-01` task
- **WHEN** the frontend renders this project
- **THEN** `overflow_end` MUST be `null` per spec `dashboard-task-derived-promise`
- **AND** the frontend MUST NOT draw any overflow segment for this project

---
### Requirement: Timeline x-axis extends to include overflow

The dashboard's timeline x-axis right edge and bar container width SHALL be computed as the maximum of: all visible projects' `end`, all visible projects' `overflow_end` (when non-null), and `DEFAULT_END`. Overflow segments MUST be fully visible and MUST NOT be clipped by the timeline edge.

#### Scenario: Overflow extends timeline right edge

- **GIVEN** the latest `end` among visible projects is `2026-12-31` and one project has `overflow_end = 2027-02-15`
- **WHEN** the frontend computes the timeline x-axis right edge
- **THEN** the right edge MUST be at or beyond `2027-02-15`
- **AND** that project's overflow segment ending at `2027-02-15` MUST be fully visible

#### Scenario: No overflow means timeline unchanged

- **GIVEN** all visible projects have `overflow_end = null`
- **WHEN** the frontend computes the timeline x-axis right edge
- **THEN** the right edge MUST be computed identically to the pre-existing behavior (max of all `end` and `DEFAULT_END`)

---
### Requirement: Render bars per-week based on occupied_weeks

The dashboard SHALL render each visible project's bar as independent per-week cells (one cell per ISO week column in the grid) rather than as continuous segments spanning `start` to `end`. For each week cell, the visual style SHALL be determined by three booleans derived from the project's `occupied_weeks`, `start`, `end`, and `overflow_end`:

- `occupied` = the week's ISO label is in `project.occupied_weeks`
- `in_range` = the week's Monday falls within `[project.start, project.end]` inclusive
- `in_overflow` = the week's Monday falls within `(project.end, project.overflow_end]` (only meaningful when `overflow_end` is non-null)

The rendering matrix SHALL be:

| occupied | in_range | in_overflow | Visual |
|---|---|---|---|
| true | true | — | Category color, solid filled block |
| true | false | true | Warning red (`#e3563a`), solid filled block |
| false | true | — | Category color, dashed border block (existing dashed style) |
| false | false | — | Empty (no visual) |

When the project's `task_dates` is empty (i.e., no `📅` or `✅` dates in the note), the bar SHALL fall back to the existing full-range dashed rendering across `[start, end]` (preserving the current behavior for un-scheduled projects).

#### Scenario: Per-week rendering for mixed-date project

- **GIVEN** an active project with `start = 2026-01-05`, `end = 2026-04-30`, `overflow_end = null`, and `occupied_weeks = ["2026-W03", "2026-W09"]`
- **WHEN** the frontend renders this project
- **THEN** the W3 cell MUST display a solid block in the project's category color
- **AND** the W9 cell MUST display a solid block in the project's category color
- **AND** the W1, W2, W4–W8, W10–W17 cells MUST display dashed blocks in the project's category color
- **AND** the W18 onward cells MUST be empty

#### Scenario: Overflow weeks rendered red when occupied

- **GIVEN** an active project with `start = 2026-01-05`, `end = 2026-04-30`, `overflow_end = 2026-05-21`, and `occupied_weeks = ["2026-W21"]`
- **WHEN** the frontend renders this project
- **THEN** the W21 cell MUST display a solid block in warning red (`#e3563a`)
- **AND** the W19 and W20 cells (in overflow range but not occupied) MUST be empty

#### Scenario: Project with no task dates renders full dashed bar

- **GIVEN** a project with `start = 2026-04-30`, `end = 2026-12-13`, `occupied_weeks = []`, `task_dates = []`, `promised_end = null`
- **WHEN** the frontend renders this project
- **THEN** the bar MUST render as a continuous dashed bar from W18 to W50 (current behavior)
- **AND** no per-week empty gaps MUST appear within `[start, end]`

#### Scenario: Closed project shows grayscale occupied cells only

- **GIVEN** a `done` project with `start = 2026-01-01`, `end = 2026-01-31`, `occupied_weeks = ["2026-W02", "2026-W04"]`
- **WHEN** the frontend renders this project (with "顯示已結案" checked)
- **THEN** the W2 and W4 cells MUST display solid blocks in the category color with grayscale filter + opacity 0.35 applied
- **AND** the W1, W3, and W5 cells (in range but not occupied) MUST be empty
- **AND** no dashed blocks MUST appear for this project

---
### Requirement: Tooltip shows raw task dates for occupied weeks

When the user hovers over a week cell that is `occupied`, the tooltip SHALL include the project name AND the list of raw `task_dates` from `project.task_dates` that map to that week under the per-week rules. When the `Saturday tasks count for next week` setting is on, each Saturday date that was bumped to the next week SHALL be annotated with a marker indicating it represents a next-week-execution intent. When the setting is off, no date SHALL carry that marker. Non-occupied cells (dashed or empty) SHALL keep their existing tooltip content.

#### Scenario: Tooltip lists Mon dates for current-week occupation

- **GIVEN** a project with `task_dates = ["2026-01-12", "2026-01-14"]` (both in W3)
- **WHEN** the user hovers over the W3 cell of this project
- **THEN** the tooltip MUST include `"2026-01-12"` and `"2026-01-14"`

#### Scenario: Tooltip annotates bumped Saturday dates

- **GIVEN** a project with `task_dates = ["2026-02-21"]` (Saturday, bumped to W9) and `Saturday tasks count for next week` on
- **WHEN** the user hovers over the W9 cell of this project
- **THEN** the tooltip MUST include `"2026-02-21"` AND a marker indicating Saturday → next-week execution (e.g., the literal substring `Sat → 本週執行` or equivalent annotation)

#### Scenario: Saturday dates carry no marker when the setting is off

- **GIVEN** a project with `task_dates = ["2026-02-21"]` (Saturday, ISO W8) and `Saturday tasks count for next week` off
- **WHEN** the user hovers over the W8 cell of this project
- **THEN** the tooltip MUST include `"2026-02-21"` without the Saturday marker

---
### Requirement: Per-week rendering preserves existing interactions

The per-week rendering SHALL NOT alter: category color palette, "Pin by category" sort behavior, "顯示已結案" show/hide toggle, today week red-tinted column, monthly/quarterly/weekly divider rendering, project name + warning icon column, grayscale + opacity 0.35 visual for closed projects.

#### Scenario: Interaction regression check

- **WHEN** the per-week change is applied and the dashboard is reloaded
- **THEN** clicking the "企業內訓" legend item MUST still pin that category to the top
- **AND** the "顯示已結案" checkbox MUST still toggle visibility of done/cancelled projects
- **AND** today's week column MUST still display the red tinted background
- **AND** done/cancelled project occupied cells MUST still show grayscale + opacity 0.35 filter

---
### Requirement: Render bar continuously in timeline view mode

When the dashboard's active view mode is `timeline`, each visible project's bar SHALL render as a single continuous solid-color block spanning from the week containing `start` to the week containing `max(end, overflow_end)`. The block SHALL use the project's category color. The block MUST NOT be split into per-week cells, MUST NOT render dashed segments for idle weeks, and MUST NOT render warning-red overflow segments. The block MUST sit in the same row as the project's name and span the appropriate week cells using the existing absolute-positioned bar technique (one `<div>` per project row with width = N cells * 100% - small padding).

For projects where `overflow_end` is null, the right edge SHALL be the week containing `end`. For projects with non-null `overflow_end`, the right edge SHALL be the week containing `overflow_end` (the later of the two).

For projects whose `status` is `done` or `cancelled`, the continuous block SHALL still render but with the existing `.bar.done` / `.bar.cancelled` grayscale + opacity 0.35 styling applied.

For projects whose `start` or `end` is null, no bar SHALL render in timeline view (mirroring the per-week view's filter behavior).

#### Scenario: Timeline mode renders single continuous bar

- **GIVEN** the dashboard's `viewMode` is `'timeline'`
- **AND** a project with `start = 2026-01-05`, `end = 2026-04-30`, `overflow_end = null`, `status = active`
- **WHEN** the frontend renders this project
- **THEN** exactly one `<div class="bar bar-solid ...">` MUST appear in that project's row
- **AND** the div's left edge MUST align with the week containing `2026-01-05` (W2)
- **AND** the div's right edge MUST align with the week containing `2026-04-30` (W18)
- **AND** no dashed blocks, no per-week gaps, no red blocks MUST appear in that row

#### Scenario: Timeline mode extends to overflow_end when present

- **GIVEN** `viewMode = 'timeline'`
- **AND** a project with `start = 2026-01-05`, `end = 2026-04-30`, `overflow_end = 2026-05-21`, `status = active`
- **WHEN** the frontend renders this project
- **THEN** the single bar's right edge MUST align with the week containing `2026-05-21` (W21)
- **AND** the bar MUST be entirely in the project's category color (no red segment for the W19-W21 range)

#### Scenario: Timeline mode applies grayscale to closed projects

- **GIVEN** `viewMode = 'timeline'`
- **AND** a project with `start = 2026-01-01`, `end = 2026-01-31`, `status = done`
- **WHEN** the frontend renders this project (with "顯示已結案" checked)
- **THEN** the single bar MUST render with the `.done` (or `.cancelled` for cancelled) CSS class applied
- **AND** the resulting visual MUST have grayscale filter + opacity 0.35

#### Scenario: Timeline mode skips projects missing start or end

- **GIVEN** `viewMode = 'timeline'`
- **AND** a project where either `start` or `end` is null
- **WHEN** the frontend renders this project
- **THEN** no bar MUST render in that project's row (the row remains visible with the project name but no gantt bar)

---
### Requirement: Per-week view behavior unchanged

When the dashboard's `viewMode` is `'per-week'`, the gantt rendering behavior SHALL be identical to the per-week rendering specified in this capability prior to this change (i.e., the four-state rendering matrix: occupied + in-range = solid; occupied + in-overflow = red; in-range idle = dashed; out-of-range or closed idle = blank). The introduction of timeline view mode MUST NOT alter any per-week rendering rule.

#### Scenario: Per-week mode unchanged after timeline added

- **GIVEN** `viewMode = 'per-week'`
- **WHEN** the dashboard renders any visible project
- **THEN** the visual output MUST match the per-week rendering behavior defined by the prior change `per-week-occupied-bars` (same colors, same dashed pattern, same red overflow cells, same blank gaps)

---
### Requirement: View mode switch does not refetch data

Switching between `per-week` and `timeline` modes via the `T` key (or any future programmatic switch) SHALL re-render the gantt from in-memory `data` without making a new HTTP request to `/data.json`.

#### Scenario: Toggling T does not hit the network

- **GIVEN** the dashboard has finished its initial render
- **WHEN** the user presses `T` to toggle view modes
- **THEN** the Network panel in browser dev tools MUST NOT show any new request to `/data.json`
- **AND** the gantt MUST visibly re-render in the new mode within one paint cycle

---
### Requirement: Settled week rendering

A week that is `occupied` and within the project's `[start, end]` range but whose every contributing task is complete (a `settled` week) SHALL be rendered distinctly from a week that still has an outstanding task. The dashboard SHALL render a settled week using the project's category color at reduced opacity, overlaid with a checkmark (`✅`) glyph drawn to fit the week cell. A settled week MUST NOT be rendered as a dashed or blank cell — the filled cell preserves the record that the week had scheduled tasks.

Task completion SHALL be judged at the **task level**, not per date marker: a task is complete when its source line's checkbox is `[x]` OR the line contains a `✅` date marker (`✅` followed by whitespace and an ISO `YYYY-MM-DD` date). A `✅` that is not followed by a date, such as one inside a link to a finished note (`[[✅ P-2026 範例：已完成專案]]`), SHALL NOT make a task complete. All dates contributed by a complete task inherit that completion. A week is settled iff it is in `occupied_weeks` AND no incomplete task contributes a date to it (equivalently, it is not in the set of weeks derived from incomplete tasks' dates).

Completion status SHALL be conveyed by the checkmark glyph (and opacity), never by a distinct hue. The category color and the overflow warning color remain the only hue-carrying semantics; future categories therefore never need to reserve a color for completion.

#### Scenario: All-done week renders as settled

- **GIVEN** an active project whose week `2026-W24` contains only completed tasks (each line is `[x]` or carries a `✅` date marker)
- **WHEN** the frontend renders this project
- **THEN** the `2026-W24` cell MUST be filled with the project's category color at reduced opacity
- **AND** a checkmark glyph MUST be overlaid on the cell
- **AND** the cell MUST NOT be dashed or blank

#### Scenario: Week with an outstanding task stays solid

- **GIVEN** a project whose week `2026-W23` contains a task line `- [ ] 和客戶確認合約修改 📅 2026-06-02` that is not checked and has no `✅`
- **WHEN** the frontend renders this project
- **THEN** the `2026-W23` cell MUST be the fully saturated category-color solid fill with no checkmark

#### Scenario: Mixed week counts as outstanding

- **GIVEN** a week containing one completed task and one incomplete task
- **WHEN** the frontend renders this project
- **THEN** the week MUST render as fully saturated solid (outstanding), NOT as settled

#### Scenario: Task with both 📅 and ✅ is treated as complete

- **GIVEN** a task line `- [x] 確認合約 📅 2026-05-01 ✅ 2026-04-26`
- **WHEN** the scanner derives completion
- **THEN** both the `2026-05-01` and `2026-04-26` weeks MUST treat this task as complete (the presence of a `📅` date MUST NOT make it outstanding)

#### Scenario: Overflow takes priority over settled

- **GIVEN** a week that is both in the overflow range (`end` < week ≤ `overflow_end`) and contains only completed tasks
- **WHEN** the frontend renders this project
- **THEN** the cell MUST render as the overflow warning color, NOT as the settled (dimmed + checkmark) style

#### Scenario: A link to a finished note does not complete a task

- **GIVEN** a project whose week `2026-W23` contains the task line `- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]] 📅 2026-06-02`
- **WHEN** the scanner derives completion
- **THEN** the task MUST be incomplete and the `2026-W23` cell MUST render as outstanding, not settled
