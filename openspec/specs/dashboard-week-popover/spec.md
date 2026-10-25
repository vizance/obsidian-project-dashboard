# dashboard-week-popover Specification

## Purpose

Let the user click a task-bearing week cell to open a floating popover with that cell's task details, as an alternative to hovering for the native tooltip.

## Requirements

### Requirement: Click a week cell to open a popover

The dashboard SHALL open a single floating popover when the user clicks a week cell that carries task content — specifically a cell rendered as `.bar-solid` (including the settled variant) or `.bar-overflow` with a non-empty `title`. The popover's visible text SHALL equal that cell's existing `title` string (the output of `buildWeekTooltip`: project name, ISO week label, and one line per task with its `✓`/`·` marker, date, and any Saturday-bump annotation), with line breaks preserved. The popover SHALL be populated via `textContent` (not `innerHTML`) and render newlines via CSS `white-space: pre-line`.

Clicking a cell that does NOT carry task content — a dashed cell (`本週無排定任務` or the unscheduled dashed segment) or any area outside a task-bearing cell — SHALL NOT open a popover.

The native hover `title` tooltip SHALL remain unchanged; the popover is an additional path that reads the same `title`, so the two always show identical content.

#### Scenario: Clicking an occupied cell shows its tasks

- **GIVEN** a project whose week `2026-W25` is rendered as a solid (outstanding) cell with two task lines in its `title`
- **WHEN** the user clicks that cell
- **THEN** a popover MUST appear whose visible text equals the cell's `title`
- **AND** the text MUST preserve the per-task line breaks

#### Scenario: Clicking a dashed empty cell does nothing

- **GIVEN** an in-range week with no scheduled task, rendered as a dashed cell
- **WHEN** the user clicks that cell
- **THEN** no popover MUST appear

#### Scenario: Native tooltip still present

- **GIVEN** the popover feature is active
- **WHEN** the user hovers (without clicking) over a task-bearing cell
- **THEN** the native `title` tooltip MUST still be available and its content MUST match what the popover would show

---
### Requirement: Popover positioning stays within the viewport

The popover SHALL be positioned adjacent to the clicked cell using viewport coordinates (`position: fixed`), anchored below the cell by default. When the popover would overflow the right edge of the viewport, it SHALL flip to align its right edge to the cell and expand leftward. When it would overflow the bottom edge, it SHALL flip to appear above the cell. The popover MUST be fully visible (not clipped) regardless of where the clicked cell sits in the horizontally scrollable chart.

#### Scenario: Cell near the right edge flips left

- **GIVEN** a task-bearing cell whose right edge is close to the viewport's right edge
- **WHEN** the user clicks it
- **THEN** the popover MUST remain fully within the viewport horizontally (flipped to expand leftward)

---
### Requirement: A single popover with explicit dismissal

At most one popover SHALL exist at any time. The dashboard SHALL close the open popover when ANY of the following occur: the user clicks the same cell again (toggle), the user presses `Escape`, the user clicks any area outside the popover, or the chart is scrolled. Pressing `Escape` to close the popover SHALL NOT alter the state of other keyboard shortcuts (`T`, `?`, `/`) or other UI elements.

#### Scenario: Re-clicking the same cell toggles it closed

- **GIVEN** a popover is open for cell `2026-W25`
- **WHEN** the user clicks that same cell again
- **THEN** the popover MUST close

#### Scenario: Escape closes the popover only

- **GIVEN** a popover is open
- **WHEN** the user presses `Escape`
- **THEN** the popover MUST close
- **AND** the view mode and help panel states MUST remain unchanged

#### Scenario: Opening a second cell replaces the first

- **GIVEN** a popover is open for cell A
- **WHEN** the user clicks a different task-bearing cell B
- **THEN** the popover for A MUST close and a popover for B MUST open
- **AND** only one popover MUST be present
