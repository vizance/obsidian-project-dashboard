## MODIFIED Requirements

### Requirement: Dashboard follows a consistent rendering and interaction model

Within the dashboard tab, the plugin SHALL implement the rendering and interaction behavior specified by the capabilities `dashboard-gantt-rendering`, `dashboard-task-derived-promise`, `dashboard-weekly-divider`, `dashboard-layout-spacing`, `dashboard-status-controls`, `dashboard-sort-modes`, `dashboard-resizable-proj-col`, `dashboard-week-popover`, `dashboard-keyboard-shortcuts`, `dashboard-month-view`, `dashboard-calendar-row`, and the UI parts of `dashboard-category-override`, except where this capability or `dashboard-note-sync` defines a host-specific replacement (data source, preference storage, override storage, shortcut scope). When those capabilities disagree with each other, the most specific capability for the behaviour in question SHALL be the reference. The rendered DOM SHALL be built with Obsidian element-creation helpers and CSS classes scoped under the root class `project-dashboard`; dynamic values (category colors, multi-week bar widths, project column width) SHALL be applied through CSS custom properties. Week-cell decisions SHALL come from a pure cell model whose cell kinds are `solid`, `settled`, `overflow`, `dashed`, `span-dashed`, `span-solid`, and `blank`, and whose tooltip text matches the week's derived state.

#### Scenario: Re-render is stable across restarts

- **GIVEN** the dashboard tab is open with a set of category overrides
- **WHEN** the user relaunches Obsidian and reopens the dashboard tab
- **THEN** the project rows MUST appear in the same order as before
- **AND** every week cell of every row MUST have the same visual state as before
- **AND** the quarter, month, and week headers and the today column MUST match

#### Scenario: Cell model kinds

- **WHEN** the cell model evaluates the cases below in `per-week` mode
- **THEN** it MUST return the expected kind

##### Example: per-week cell kinds

| Project state | Week | Expected kind |
| ------------- | ---- | ------------- |
| active, week in `[start, end]`, has an incomplete task that week | W44 | `solid` |
| active, week in `[start, end]`, all tasks that week complete | W30 | `settled` |
| active, week in `[start, end]`, no task that week | W40 | `dashed` |
| active, week after `end` and up to `overflow_end`, has a task | W50 | `overflow` |
| active, no task dates at all, first week of `[start, end]` | start week | `span-dashed` |
| done, week in `[start, end]`, no task that week | W40 | `blank` |

