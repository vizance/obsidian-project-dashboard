## MODIFIED Requirements

### Requirement: Re-render preserves the user's view state

An automatic re-render triggered by a note change, by a settings change, or by plugin data changed outside the running plugin SHALL rebuild only the header statistics, the legend, and the gantt chart. It SHALL preserve the chart's horizontal scroll position, the tab's vertical scroll position, the `顯示已結案` and `編輯分類` checkbox states, the view mode, whether the year view or the month view is shown, the month shown in the month view, the pinned category, the category order, and the project column width. When a week popover was open before the re-render, the dashboard SHALL re-open it after the re-render for the same note path and the same ISO week, with the same footer section expanded (the unscheduled-task list, the new-task input, or none), provided that week of that project is still rendered, in the view being shown, as a cell that can open a popover. Otherwise the popover SHALL be closed. Text in the new-task input that was already submitted SHALL be cleared; text that was typed but not yet submitted SHALL be kept. The input SHALL regain focus only if it had focus before the re-render, so a re-render caused by typing in a note never moves focus into the dashboard. The same rule SHALL apply to the immediate re-scan that follows a stale or invalid edit.

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

#### Scenario: Popover stays on its week when the Saturday setting changes

- **GIVEN** the project `範例專案 A` runs from `2026-10-01` to `2026-12-31`, its note contains `- [ ] 寄出合約 📅 2026-10-31`, `Saturday tasks count for next week` is off, and the popover for `2026-W44` is open listing `寄出合約`
- **WHEN** the user turns on `Saturday tasks count for next week` and the change is applied
- **THEN** a popover for `範例專案 A` and `2026-W44` MUST be visible and MUST NOT list `寄出合約`
- **AND** the popover for `2026-W45`, when opened, MUST list `寄出合約` with `預排在上週六，算進本週`

#### Scenario: The month view keeps its month

- **GIVEN** the month view shows `2026 年 11 月（W45–W49）` and the popover for `範例專案 A` and `2026-W46` is open
- **WHEN** a relevant note change causes a re-render
- **THEN** the month view MUST still show `2026 年 11 月（W45–W49）`
- **AND** the popover for `範例專案 A` and `2026-W46` MUST be open, anchored at that project's `W46` cell in the month view
