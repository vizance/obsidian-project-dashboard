## MODIFIED Requirements

### Requirement: Render bars per-week based on occupied_weeks

The dashboard SHALL render each visible project's bar as independent per-week cells (one cell per ISO week column in the grid) rather than as continuous segments spanning `start` to `end`. Each week cell's style SHALL depend only on that week and the project — never on which other weeks are shown — through these facts:

- `occupied` = the week's ISO label is in `project.occupied_weeks` (task dates mapped to weeks with the current Saturday setting)
- `in_range` = the week overlaps the half-open range `[project.start, project.end)`
- `after_end` = the week's Monday is on or after `project.end`
- `closed` = the project's status is `done` or `cancelled`

The rendering matrix SHALL be:

| occupied | position | closed | Visual |
|---|---|---|---|
| true | `after_end` | false | Warning red (`#e3563a`), solid filled block (overflow) |
| true | any other week, including weeks before `start` | false | Category color, solid filled block (settled when every task of the week is complete) |
| true | any | true | Category color, solid filled block with the closed styling |
| false | `in_range` | false | Category color, dashed border block (existing dashed style) |
| false | otherwise | — | Empty (no visual) |

Every week that has a task line therefore has a drawn cell and can open the week popover, whatever the project's start and expected end dates are; the expected end date only decides whether such a week is marked as overflow.

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

#### Scenario: A Saturday task after the expected end stays visible

- **GIVEN** an active project with `start = 2026-06-29` and `end = 2026-11-06`, `Saturday tasks count for next week` turned on, and a note containing `- [ ] 追蹤款項 📅 2026-12-05` (a Saturday)
- **WHEN** the year view of 2026 renders this project
- **THEN** the W50 cell MUST be a warning-red overflow block and MUST open the week popover listing `追蹤款項`
- **AND** the W47, W48, and W49 cells MUST be empty

#### Scenario: A task before the start date stays visible

- **GIVEN** an active project with `start = 2026-11-02`, `end = 2026-12-31`, and a note containing `- [ ] 前置作業 📅 2026-10-28`
- **WHEN** the year view of 2026 renders this project
- **THEN** the W44 cell MUST be a solid block in the category color and MUST open the week popover listing `前置作業`

#### Scenario: A closed project's task after its end stays visible

- **GIVEN** a `done` project with `start = 2026-01-01`, `end = 2026-01-31`, and a note containing `- [x] 結案報告 📅 2026-02-10 ✅ 2026-02-10`, with "顯示已結案" checked
- **WHEN** the year view of 2026 renders this project
- **THEN** the W7 cell MUST be a solid block with the closed styling

---
### Requirement: Render bar continuously in timeline view mode

When the year view is shown and the dashboard's active view mode is `timeline`, each visible project's bar SHALL render as a single continuous solid-color block spanning from the earlier of the week containing `start` and the first week in `occupied_weeks`, to the later of the week containing `end` and the last week in `occupied_weeks`, clipped to the shown year. The block SHALL use the project's category color. The block MUST NOT be split into per-week cells, MUST NOT render dashed segments for idle weeks, and MUST NOT render warning-red overflow segments. The block MUST sit in the same row as the project's name and span the appropriate week cells using the existing absolute-positioned bar technique (one `<div>` per project row with width = N cells * 100% - small padding).

When no week in `occupied_weeks` lies after the week containing `end`, the right edge SHALL be the week containing `end`; otherwise it SHALL be the last week in `occupied_weeks`. When no week in `occupied_weeks` lies before the week containing `start`, the left edge SHALL be the week containing `start`; otherwise it SHALL be the first week in `occupied_weeks`.

For projects whose `status` is `done` or `cancelled`, the continuous block SHALL still render but with the existing `.bar.done` / `.bar.cancelled` grayscale + opacity 0.35 styling applied.

For projects whose `start` or `end` is null, no bar SHALL render in timeline view (mirroring the per-week view's filter behavior). The month view SHALL NOT use the timeline rendering.

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

