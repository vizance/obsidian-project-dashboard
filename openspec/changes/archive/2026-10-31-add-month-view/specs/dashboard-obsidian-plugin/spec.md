## MODIFIED Requirements

### Requirement: Interface preferences use vault-scoped local storage

The plugin SHALL store interface preferences with Obsidian's vault-scoped local storage (`app.loadLocalStorage` / `app.saveLocalStorage`) using the same keys and value formats as the web version: `dashboard.viewMode` (`per-week` or `timeline`), `dashboard.helpPanelOpen` (`true` or `false`), `dashboard.helpFirstSeen` (`true`), `dashboard.categoryOrder` (JSON array of category keys), `dashboard.pinnedCategory` (JSON string key or `null`), `dashboard.projColWidth` (integer pixels), and `dashboard.scale` (`year` or `month`). Validation and defaults SHALL be the same as the web version: view mode defaults to `per-week`; the scale defaults to `year` when missing or not one of `year` and `month`; the category order drops unknown keys and appends missing ones after the stored order, defaulting to `corporate, online_course, coaching, publishing, sponsorship, life, other`; a pinned value that is not an existing category becomes `null`; the column width defaults to 280 and is clamped to 120–600. Any read or write failure SHALL fall back to defaults without interrupting rendering.

#### Scenario: Column width survives a restart

- **WHEN** the user drags the project column to 220px and relaunches Obsidian
- **THEN** the project column MUST render at 220px

##### Example: stored value handling

| Key | Stored value | Applied value |
| --- | ------------ | ------------- |
| `dashboard.projColWidth` | `'50'` | 120 |
| `dashboard.projColWidth` | `'abc'` | 280 |
| `dashboard.categoryOrder` | `'["publishing","unknown_cat","corporate"]'` | publishing, corporate, online_course, coaching, sponsorship, life, other |
| `dashboard.pinnedCategory` | `'"unknown_cat"'` | `null` |
| `dashboard.viewMode` | absent | `per-week` |
| `dashboard.scale` | absent | `year` |
| `dashboard.scale` | `'week'` | `year` |
| `dashboard.scale` | `'month'` | `month` |

---
### Requirement: Dashboard follows a consistent rendering and interaction model

Within the dashboard tab, the plugin SHALL implement the rendering and interaction behavior specified by the capabilities `dashboard-gantt-rendering`, `dashboard-task-derived-promise`, `dashboard-weekly-divider`, `dashboard-layout-spacing`, `dashboard-status-controls`, `dashboard-sort-modes`, `dashboard-resizable-proj-col`, `dashboard-week-popover`, `dashboard-keyboard-shortcuts`, `dashboard-month-view`, and the UI parts of `dashboard-category-override`, except where this capability or `dashboard-note-sync` defines a host-specific replacement (data source, preference storage, override storage, shortcut scope). When those capabilities disagree with each other, the most specific capability for the behaviour in question SHALL be the reference. The rendered DOM SHALL be built with Obsidian element-creation helpers and CSS classes scoped under the root class `project-dashboard`; dynamic values (category colors, multi-week bar widths, project column width) SHALL be applied through CSS custom properties. Week-cell decisions SHALL come from a pure cell model whose cell kinds are `solid`, `settled`, `overflow`, `dashed`, `span-dashed`, `span-solid`, and `blank`, and whose tooltip text matches the week's derived state.

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

---
### Requirement: Keyboard shortcuts act only in the active dashboard tab

The shortcuts `T` (toggle `per-week` / `timeline` in the year view), `M` (toggle the year view and the month view), `?` and `/` (toggle the help panel), and `Escape` (close the week popover) SHALL be registered on the dashboard view's own keymap scope, so they fire only while the dashboard tab is the active leaf. `T`, `M`, `?`, and `/` SHALL be ignored while focus is in an `input`, `textarea`, or `select` element, or while Ctrl, Cmd, or Alt is held. `Escape` SHALL be ignored while focus is in a text-entry element (a text `input`, a `textarea`, or a `select`) or while Ctrl, Cmd, or Alt is held; a focused checkbox, such as a task row's checkbox in the week popover, SHALL NOT block it. `Escape` SHALL be consumed only when a week popover is open; otherwise it SHALL pass through to Obsidian unchanged.

#### Scenario: Typing T in a note does not toggle the view

- **GIVEN** the dashboard tab is open but a Markdown note tab is active
- **WHEN** the user types `T` in the note
- **THEN** the character MUST be inserted into the note
- **AND** the dashboard view mode MUST NOT change

#### Scenario: T toggles while the dashboard is active

- **GIVEN** the dashboard tab is active in `per-week` mode and no input is focused
- **WHEN** the user presses `T`
- **THEN** the chart MUST re-render in `timeline` mode without re-scanning the vault
- **AND** `dashboard.viewMode` MUST be stored as `timeline`

#### Scenario: Escape closes the popover after ticking a task

- **GIVEN** a week popover is open and the user has just clicked a task row's checkbox, so that checkbox has focus
- **WHEN** the user presses `Escape`
- **THEN** the popover MUST close

#### Scenario: Typing M in a note does not switch the view

- **GIVEN** the dashboard tab is open but a Markdown note tab is active
- **WHEN** the user types `M` in the note
- **THEN** the character MUST be inserted into the note
- **AND** the dashboard MUST keep showing the same view
