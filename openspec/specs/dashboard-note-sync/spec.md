# dashboard-note-sync Specification

## Purpose

Keep the dashboard tab in step with the project notes: re-scan and re-render after project notes change without disturbing the user's view, and open a project's note in a reusable split to the right of the dashboard.

## Requirements

### Requirement: Project note changes trigger a debounced re-scan

The plugin SHALL listen to the vault's `modify`, `create`, `delete`, and `rename` events. An event SHALL count as relevant only when the affected file is a Markdown file that is a direct child of the configured project folder (`PROJECT_FOLDER`, default `Projects`); for `rename`, the event SHALL count as relevant when either the new path or the old path satisfies this condition. Relevant events SHALL schedule a full re-scan of the project folder 400 ms after the most recent relevant event, so that a burst of events produces exactly one re-scan. After the re-scan the open dashboard tab SHALL re-render. Irrelevant events SHALL NOT trigger a re-scan. When no dashboard tab is open, the plugin SHALL NOT re-scan.

#### Scenario: Moving a task date updates two week cells

- **GIVEN** a project note contains `- [ ] 確認拍攝服裝 📅 2026-10-30` and the dashboard shows that task in the `W44` cell
- **WHEN** the user changes the date to `📅 2026-11-06` in the note and Obsidian saves the file
- **THEN** within 1 second the dashboard MUST re-render
- **AND** the `W44` cell tooltip MUST no longer list `確認拍攝服裝`
- **AND** the `W45` cell tooltip MUST list `確認拍攝服裝（2026-11-06 預計）`

#### Scenario: Renaming a note to done closes the project

- **GIVEN** `🚧 P-202609 ~ 202612 範例專案.md` is shown as an active row and `顯示已結案` is unchecked
- **WHEN** the user renames the file to `✅ P-202609 ~ 202612 範例專案.md`
- **THEN** after the re-scan the project MUST no longer appear as a row

#### Scenario: Notes outside the project folder are ignored

- **WHEN** the user edits a daily note or a note under `<the configured project folder>/Task notes/`
- **THEN** no re-scan MUST occur

##### Example: debounce timing

| Relevant events (ms after first) | Re-scans | Re-scan time (ms after first) |
| -------------------------------- | -------- | ----------------------------- |
| 0 | 1 | 400 |
| 0, 100, 250, 380, 500 | 1 | 900 |
| 0, 600 | 2 | 400 and 1000 |

---
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

---
### Requirement: Clicking a project name opens the note to the right

Clicking a project's name in the left column SHALL open that project's note in a vertical split to the right of the dashboard, leaving the dashboard visible. The plugin SHALL remember that split leaf; on later clicks, when the remembered leaf is still attached to the workspace, the plugin SHALL open the clicked note in that same leaf; when it is no longer attached, the plugin SHALL create a new split to the right of the dashboard. Clicking the row's category control SHALL NOT open the note. The project name SHALL show a pointer cursor on hover and the tooltip `在右側開啟筆記`.

#### Scenario: First click creates a split

- **GIVEN** only the dashboard tab is open
- **WHEN** the user clicks `P-20260515 範例專案 A`
- **THEN** that note MUST open in a new pane to the right of the dashboard
- **AND** the dashboard MUST remain visible on the left

#### Scenario: Later clicks reuse the same split

- **GIVEN** a project note is open in the split created by the dashboard
- **WHEN** the user clicks `P-2026 範例專案 B`
- **THEN** that note MUST replace the previous note in the same right pane
- **AND** the total number of panes MUST stay two

#### Scenario: Closed split is recreated

- **GIVEN** the user closed the right pane that the dashboard had opened
- **WHEN** the user clicks a project name
- **THEN** a new pane MUST open to the right of the dashboard showing that note

#### Scenario: Category control does not open the note

- **GIVEN** `編輯分類` is checked
- **WHEN** the user clicks a row's category control
- **THEN** no note MUST open
