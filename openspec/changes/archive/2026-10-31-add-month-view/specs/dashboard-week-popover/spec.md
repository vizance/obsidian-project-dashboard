## MODIFIED Requirements

### Requirement: Click a week cell to open a popover

In the year view's `per-week` view mode, the dashboard SHALL open a single floating popover for a project and an ISO week when the user clicks any of that project's drawn week cells: a solid cell (including the settled variant), an overflow cell, an in-range dashed cell (`本週無排定任務`), or the dashed span drawn for a project without task dates. For the dashed span, the week SHALL be the span's start week plus `floor(offset / weekWidth)`, where `offset` is the horizontal distance from the left edge of the span's first week cell to the click and `weekWidth` is the total width of the week cells the span covers divided by the number of weeks, clamped to the span. Measuring the cells rather than the drawn bar (which is inset a few pixels) keeps a click right after a cell boundary in the cell it visually belongs to. The popover content SHALL follow the `dashboard-task-editing` capability (task rows, controls, and the two footer entries) and SHALL be built with DOM element APIs, never `innerHTML`.

Clicking a blank cell (outside the project's date range, or a project row with missing dates) SHALL NOT open a popover.

The view mode applies to the year view only. In the month view, a cell whose kind is `solid`, `settled`, `overflow`, or `dashed` SHALL always open the editable popover for its project and week, as defined by `dashboard-month-view`, whatever `dashboard.viewMode` holds.

In the year view's `timeline` view mode, clicking a span bar with a non-empty `title` SHALL open the popover with that `title` text only, read-only, rendered with `white-space: pre-line`; no editing controls SHALL appear in this mode.

The native hover `title` tooltip of every cell SHALL remain unchanged. For a task-bearing cell, the tasks listed in the popover SHALL be the same tasks the `title` lists, with each source line shown once.

#### Scenario: Clicking an occupied cell shows its tasks

- **GIVEN** a project whose week `2026-W25` is rendered as a solid (outstanding) cell with two task lines
- **WHEN** the user clicks that cell in `per-week` mode
- **THEN** a popover MUST appear listing those two tasks as rows with their controls

#### Scenario: Clicking a dashed empty cell opens an empty week

- **GIVEN** an in-range week `2026-W45` with no scheduled task, rendered as a dashed cell
- **WHEN** the user clicks that cell
- **THEN** a popover for `2026-W45` MUST appear showing `這週還沒有任務`
- **AND** the two footer entries MUST be available

#### Scenario: Clicking inside a dashed span picks the clicked week

- **GIVEN** a project without task dates whose dashed span covers `2026-W40` to `2026-W49` (10 weeks, 400 px wide)
- **WHEN** the user clicks 95 px from the span's left edge
- **THEN** the popover MUST open for `2026-W42`

#### Scenario: Clicking a blank cell does nothing

- **GIVEN** a week outside the project's date range, rendered blank
- **WHEN** the user clicks it
- **THEN** no popover MUST appear

#### Scenario: Timeline mode stays read-only

- **GIVEN** the view mode is `timeline`
- **WHEN** the user clicks a project's span bar
- **THEN** the popover MUST show the bar's `title` text
- **AND** no checkbox, arrow, or footer entry MUST appear

#### Scenario: Native tooltip still present

- **GIVEN** the popover feature is active
- **WHEN** the user hovers (without clicking) over a task-bearing cell
- **THEN** the native `title` tooltip MUST still be available and list the same tasks as the popover
