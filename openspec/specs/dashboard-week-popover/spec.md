# dashboard-week-popover Specification

## Purpose

Let the user click a task-bearing week cell to open a floating popover with that cell's task details, as an alternative to hovering for the native tooltip.

## Requirements

### Requirement: Click a week cell to open a popover

In the `per-week` view mode, the dashboard SHALL open a single floating popover for a project and an ISO week when the user clicks any of that project's drawn week cells: a solid cell (including the settled variant), an overflow cell, an in-range dashed cell (`本週無排定任務`), or the dashed span drawn for a project without task dates. For the dashed span, the week SHALL be the span's start week plus `floor(offset / weekWidth)`, where `offset` is the horizontal distance from the left edge of the span's first week cell to the click and `weekWidth` is the total width of the week cells the span covers divided by the number of weeks, clamped to the span. Measuring the cells rather than the drawn bar (which is inset a few pixels) keeps a click right after a cell boundary in the cell it visually belongs to. The popover content SHALL follow the `dashboard-task-editing` capability (task rows, controls, and the two footer entries) and SHALL be built with DOM element APIs, never `innerHTML`.

Clicking a blank cell (outside the project's date range, or a project row with missing dates) SHALL NOT open a popover.

In the `timeline` view mode, clicking a span bar with a non-empty `title` SHALL open the popover with that `title` text only, read-only, rendered with `white-space: pre-line`; no editing controls SHALL appear in this mode.

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

---
### Requirement: Popover positioning stays within the viewport

The popover SHALL be attached to the document body, outside the dashboard tab, and removed when the dashboard tab closes: Obsidian's tab container applies `contain: strict` and `overflow: hidden`, which would re-anchor a fixed-position popover to the tab and clip it whenever a sidebar or a split beside the dashboard is open. The popover SHALL be positioned adjacent to its anchor using viewport coordinates (`position: fixed`), anchored below by default, and layered above the workspace like Obsidian's own popovers. The anchor SHALL be the clicked cell; for a dashed span it SHALL be the table cell of the computed week. Horizontally the popover SHALL stay within the dashboard pane when the pane is wide enough for it, so it does not cover the note beside the dashboard; when it would overflow the pane's right edge it SHALL flip to align its right edge to the anchor and expand leftward. When the pane is narrower than the popover, the viewport's edges SHALL be used instead. When it would overflow the bottom edge, it SHALL flip to appear above the anchor. The popover SHALL be re-positioned whenever its content height changes (a footer section is expanded or collapsed). The popover MUST be fully visible (not clipped) regardless of where the anchor sits in the horizontally scrollable chart; when its content is taller than the space available, the task list and the unscheduled list SHALL scroll inside the popover.

#### Scenario: Cell near the right edge flips left

- **GIVEN** a cell whose right edge is close to the viewport's right edge
- **WHEN** the user clicks it
- **THEN** the popover MUST remain fully within the viewport horizontally (flipped to expand leftward)

#### Scenario: Left sidebar open does not clip the popover

- **GIVEN** Obsidian's left sidebar is open beside the dashboard
- **WHEN** the user clicks a week cell
- **THEN** the popover MUST appear next to that cell, fully visible and fully usable (header, rows, and both footer entries reachable)

#### Scenario: Note split open on the right still opens popovers

- **GIVEN** a note is open in the split to the right of the dashboard
- **WHEN** the user clicks a week cell near the dashboard's right edge
- **THEN** the popover MUST appear fully visible, within the dashboard pane, flipped to expand leftward

#### Scenario: Expanding a section keeps the popover visible

- **GIVEN** a popover opened for a cell near the bottom of the viewport
- **WHEN** the user expands the unscheduled-task list
- **THEN** the popover MUST be re-positioned so that it stays fully within the viewport

---
### Requirement: A single popover with explicit dismissal

At most one popover SHALL exist at any time. The dashboard SHALL close the open popover when ANY of the following occur: the user clicks the same cell (or, for a dashed span, the same week of that span) again, the user presses `Escape` while focus is not in a text-entry element (the popover's text input, another text input, a textarea, or a select; a focused checkbox, including a task row's checkbox, does not block it), the user clicks any area outside the popover, the user clicks a row's `↗` button, or a scroll event occurs on an element that contains the popover's anchor cell (the chart, the dashboard tab, or the document), because only such a scroll moves the anchor away from the fixed-position popover. Scrolling inside the popover, scrolling another pane (for example the note opened beside the dashboard), the scroll-position restore performed by an automatic re-render, and clicking inside the popover (other than `↗`) SHALL NOT close it. Pressing `Escape` while focus is in the popover's text input SHALL close the input only. Pressing `Escape` to close the popover SHALL NOT alter the state of other keyboard shortcuts (`T`, `?`, `/`) or other UI elements.

#### Scenario: Re-clicking the same cell toggles it closed

- **GIVEN** a popover is open for cell `2026-W25`
- **WHEN** the user clicks that same cell again
- **THEN** the popover MUST close

#### Scenario: Escape closes the popover only

- **GIVEN** a popover is open and focus is not in its text input
- **WHEN** the user presses `Escape`
- **THEN** the popover MUST close
- **AND** the view mode and help panel states MUST remain unchanged

#### Scenario: Escape in the input keeps the popover

- **GIVEN** a popover is open with the new-task input focused
- **WHEN** the user presses `Escape`
- **THEN** the input MUST close
- **AND** the popover MUST stay open

#### Scenario: Scrolling the unscheduled list keeps the popover

- **GIVEN** a popover whose unscheduled list is long enough to scroll
- **WHEN** the user scrolls that list
- **THEN** the popover MUST stay open

#### Scenario: Scrolling the note beside the dashboard keeps the popover

- **GIVEN** a popover is open and a note is open in the split beside the dashboard
- **WHEN** that note's editor scrolls, by the user or because the dashboard's edit changed the note
- **THEN** the popover MUST stay open

#### Scenario: Scrolling the chart closes the popover

- **GIVEN** a popover is open
- **WHEN** the user scrolls the chart horizontally
- **THEN** the popover MUST close

#### Scenario: Opening a second cell replaces the first

- **GIVEN** a popover is open for cell A
- **WHEN** the user clicks a different eligible cell B
- **THEN** the popover for A MUST close and a popover for B MUST open
- **AND** only one popover MUST be present
