## MODIFIED Requirements

### Requirement: Re-render preserves the user's view state

An automatic re-render triggered by a note change SHALL rebuild only the header statistics, the legend, and the gantt chart. It SHALL preserve the chart's horizontal scroll position, the tab's vertical scroll position, the `顯示已結案` and `編輯分類` checkbox states, the view mode, the pinned category, the category order, and the project column width. When a week popover was open before the re-render, the dashboard SHALL re-open it after the re-render for the same note path and the same ISO week, with the same footer section expanded (the unscheduled-task list, the new-task input, or none), provided that week of that project is still rendered as a cell that can open a popover. Otherwise the popover SHALL be closed. Text in the new-task input that was already submitted SHALL be cleared; text that was typed but not yet submitted SHALL be kept. The input SHALL regain focus only if it had focus before the re-render, so a re-render caused by typing in a note never moves focus into the dashboard. The same rule SHALL apply to the immediate re-scan that follows a stale or invalid edit.

#### Scenario: Scroll position stays put

- **GIVEN** the user has scrolled the chart horizontally so that `W40` is the leftmost visible week and has checked `顯示已結案`
- **WHEN** a relevant note change causes a re-render
- **THEN** `W40` MUST still be the leftmost visible week
- **AND** `顯示已結案` MUST still be checked

#### Scenario: Popover re-opens after its own edit

- **GIVEN** the popover for `範例專案 A` and `2026-W44` is open
- **WHEN** the user ticks a task in it and the note change causes a re-render
- **THEN** a popover for `範例專案 A` and `2026-W44` MUST be visible after the re-render
- **AND** that task's row MUST show it as done

#### Scenario: Unscheduled list stays expanded

- **GIVEN** the popover for `2026-W45` is open with the unscheduled-task list expanded
- **WHEN** the user picks a task from the list and the note change causes a re-render
- **THEN** the re-opened popover MUST show the unscheduled-task list expanded
- **AND** the picked task MUST no longer be in that list

#### Scenario: Popover closes when its cell is gone

- **GIVEN** the popover for a project is open and `顯示已結案` is unchecked
- **WHEN** the user renames that project's note so its status becomes `done` and the re-render runs
- **THEN** no week popover MUST be visible
