# dashboard-obsidian-plugin Specification

## Purpose

Run the project dashboard as an Obsidian plugin tab: how it opens and is restored, where it reads projects from, where preferences and category overrides are stored, how shortcuts are scoped, and how it is built and deployed into the vault.

## Requirements

### Requirement: Dashboard opens as a single Obsidian tab

The plugin (id `project-dashboard`) SHALL register a custom view of type `project-dashboard-view` that renders the project dashboard in a tab of Obsidian's main editing area. The plugin SHALL add a ribbon icon (lucide `calendar-range`, tooltip `Open project dashboard`) and a command (id `open-dashboard`, name `Open dashboard`; Obsidian prefixes it with the plugin name, so the command palette shows `Project Dashboard: Open dashboard`). Plugin-level names — the plugin name, the ribbon tooltip, and command names — SHALL be written in English; the dashboard's own interface text inside the tab SHALL remain Traditional Chinese. Both entry points SHALL call the same activation routine: when a leaf of type `project-dashboard-view` already exists, the routine SHALL reveal and focus that leaf; otherwise it SHALL open exactly one new tab containing the view. The plugin SHALL NOT start any HTTP server or open any browser window.

#### Scenario: Ribbon icon opens the dashboard tab

- **WHEN** the user clicks the `Open project dashboard` ribbon icon and no dashboard tab exists
- **THEN** a new tab of type `project-dashboard-view` MUST open in the main editing area
- **AND** the tab MUST render the dashboard header, controls, and gantt chart

#### Scenario: Second activation focuses the existing tab

- **GIVEN** a dashboard tab is already open
- **WHEN** the user runs the command `Project Dashboard: Open dashboard`
- **THEN** the existing dashboard tab MUST become the active tab
- **AND** the number of `project-dashboard-view` leaves MUST remain exactly one

---
### Requirement: Dashboard tab is restored with the workspace

When a dashboard tab is open at the moment Obsidian quits, Obsidian SHALL restore it on the next launch and the plugin SHALL render it with freshly scanned data. The plugin SHALL NOT provide a separate "open on startup" setting.

#### Scenario: Restart restores the tab

- **GIVEN** the dashboard tab is open
- **WHEN** the user quits and relaunches Obsidian
- **THEN** the dashboard tab MUST be present and rendered without the user clicking the ribbon icon or running the command

---
### Requirement: Projects are scanned from the vault project folder

The plugin SHALL read projects from the configured project folder (`PROJECT_FOLDER`, default `Projects`) and SHALL scan only Markdown files that are direct children of that folder. Files in subfolders (for example a `Task notes` subfolder) SHALL NOT be scanned. Files SHALL be processed in code-point order of their filenames. When the folder does not exist, the view SHALL display the message `找不到專案資料夾：<folder>` instead of a chart and SHALL NOT throw. When a single note cannot be read, the plugin SHALL skip that note, log the failure to the developer console, and render all other projects.

#### Scenario: Subfolder notes are excluded

- **GIVEN** the project folder contains `🚧 P-20260515 範例專案 A.md` and the subfolder note `Task notes/✅ T-2026 校正逐字稿.md`
- **WHEN** the plugin scans
- **THEN** the P-20260515 project MUST appear as a project row
- **AND** the Task note MUST NOT appear as a project row

#### Scenario: Missing folder shows a message

- **GIVEN** the vault has no folder matching the configured project folder
- **WHEN** the dashboard tab renders
- **THEN** the tab MUST show `找不到專案資料夾：<folder>`
- **AND** no uncaught exception MUST be raised

---
### Requirement: Scanner derives consistent project records from note content

For every scanned note, the plugin scanner SHALL produce a project record with fields `name`, `category`, `color`, `status`, `start`, `end`, `promised_end`, `overflow_end`, `task_dates`, `tasks`, `occupied_weeks`, `settled_weeks`, and `warnings`, derived deterministically from the file's name, frontmatter, and task lines. Projects listed in the excluded-project list SHALL be omitted. Status detection SHALL inspect the first three Unicode code points of the filename, so that astral emoji such as `🚧` are detected correctly.

#### Scenario: Representative records

- **WHEN** the scanner processes the inputs below with no overrides and today `2026-10-25`
- **THEN** the records MUST match the expected values

##### Example: filename and task derivations

| Filename / content | Expected |
| ------------------ | -------- |
| `🚧 P-20260413 ~ 1213 範例：家庭生活專案.md`, no frontmatter dates, no task dates | `status` = `active`, `start` = `2026-04-13`, `end` = `2026-12-13`, `warnings` = [`起日由檔名推得`, `迄日由檔名推得`], `category` = `life` |
| `✅ P-2026 範例：已完成專案.md` | `status` = `done`, `category` = `other` |
| line `- [ ] 確認拍攝服裝 📅 2026-10-30` | task `{ date: 2026-10-30, kind: planned, text: 確認拍攝服裝, done: false }`, occupied week `2026-W44` |
| line `- [ ] 盤點 📅 2026-10-31` (Saturday) | occupied week `2026-W45`, `promised_end` contribution `2026-10-31` |
| line `- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15` | both dates' weeks are settled when no other incomplete task shares them |

---
### Requirement: Calendar year follows today's local date

The plugin SHALL derive the displayed calendar year and the default end date from today's local date, formatted as `YYYY-MM-DD` in the user's local time zone. The week columns SHALL cover every ISO week whose Thursday falls in that year, and a project without any end date SHALL default to December 31 of that year with the warning `迄日預設為 <year>-12-31`. Today's date SHALL NOT be derived from a UTC conversion.

#### Scenario: Taipei early morning uses the local date

- **GIVEN** the local time zone is Asia/Taipei and the local time is 2026-10-26 07:30 (UTC 2026-10-25 23:30)
- **WHEN** the dashboard renders
- **THEN** today MUST be `2026-10-26`
- **AND** the highlighted week column MUST be `W44`

##### Example: year-derived values

| Today (local) | Week columns | Default end |
| ------------- | ------------ | ----------- |
| `2026-10-25` | `W1` through `W53` | `2026-12-31` |
| `2027-01-05` | `W1` through `W52` | `2027-12-31` |

---
### Requirement: Dashboard follows a consistent rendering and interaction model

Within the dashboard tab, the plugin SHALL implement the rendering and interaction behavior specified by the capabilities `dashboard-gantt-rendering`, `dashboard-task-derived-promise`, `dashboard-weekly-divider`, `dashboard-layout-spacing`, `dashboard-status-controls`, `dashboard-sort-modes`, `dashboard-resizable-proj-col`, `dashboard-week-popover`, `dashboard-keyboard-shortcuts`, and the UI parts of `dashboard-category-override`, except where this capability or `dashboard-note-sync` defines a host-specific replacement (data source, preference storage, override storage, shortcut scope). When those capabilities disagree with each other, the most specific capability for the behaviour in question SHALL be the reference. The rendered DOM SHALL be built with Obsidian element-creation helpers and CSS classes scoped under the root class `project-dashboard`; dynamic values (category colors, multi-week bar widths, project column width) SHALL be applied through CSS custom properties. Week-cell decisions SHALL come from a pure cell model whose cell kinds are `solid`, `settled`, `overflow`, `dashed`, `span-dashed`, `span-solid`, and `blank`, and whose tooltip text matches the week's derived state.

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
### Requirement: Interface preferences use vault-scoped local storage

The plugin SHALL store interface preferences with Obsidian's vault-scoped local storage (`app.loadLocalStorage` / `app.saveLocalStorage`) using the same keys and value formats as the web version: `dashboard.viewMode` (`per-week` or `timeline`), `dashboard.helpPanelOpen` (`true` or `false`), `dashboard.helpFirstSeen` (`true`), `dashboard.categoryOrder` (JSON array of category keys), `dashboard.pinnedCategory` (JSON string key or `null`), and `dashboard.projColWidth` (integer pixels). Validation and defaults SHALL be the same as the web version: view mode defaults to `per-week`; the category order drops unknown keys and appends missing ones after the stored order, defaulting to `corporate, online_course, coaching, publishing, sponsorship, life, other`; a pinned value that is not an existing category becomes `null`; the column width defaults to 280 and is clamped to 120–600. Any read or write failure SHALL fall back to defaults without interrupting rendering.

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

---
### Requirement: Category overrides are stored in plugin data

The plugin SHALL store manual category overrides in its plugin data as `{ "categoryOverrides": { <project full name>: <category key> } }`. Choosing a category in a row's category control SHALL write that entry; choosing `自動（清除覆寫）` SHALL delete the entry; a category key that is not one of `corporate`, `online_course`, `coaching`, `publishing`, `sponsorship`, `life`, `other` SHALL NOT be written. After a successful save the plugin SHALL re-scan, re-render, and show the toast `已更新分類`. When the save fails, the plugin SHALL show the error toast `分類儲存失敗，請再試一次`, restore the control to the project's actual category, and leave the stored overrides unchanged. Classification priority SHALL remain: exact full-name override, then name-fragment rules, then keyword rules, then `other`. At most one toast SHALL be visible at a time.

#### Scenario: Override persists across restarts

- **GIVEN** the project `P-2026 範例：家庭生活專案 @小明 @小美` is classified as `other`
- **WHEN** the user turns on `編輯分類`, picks `生活` for that row, and relaunches Obsidian
- **THEN** the plugin data MUST contain `"P-2026 範例：家庭生活專案 @小明 @小美": "life"`
- **AND** the project MUST render in the `life` color and group

#### Scenario: Failed save reverts the control

- **GIVEN** writing plugin data fails
- **WHEN** the user picks a new category for a row
- **THEN** the toast `分類儲存失敗，請再試一次` MUST appear
- **AND** the row's control MUST show the project's actual category

---
### Requirement: Keyboard shortcuts act only in the active dashboard tab

The shortcuts `T` (toggle `per-week` / `timeline`), `?` and `/` (toggle the help panel), and `Escape` (close the week popover) SHALL be registered on the dashboard view's own keymap scope, so they fire only while the dashboard tab is the active leaf. `T`, `?`, and `/` SHALL be ignored while focus is in an `input`, `textarea`, or `select` element, or while Ctrl, Cmd, or Alt is held. `Escape` SHALL be ignored while focus is in a text-entry element (a text `input`, a `textarea`, or a `select`) or while Ctrl, Cmd, or Alt is held; a focused checkbox, such as a task row's checkbox in the week popover, SHALL NOT block it. `Escape` SHALL be consumed only when a week popover is open; otherwise it SHALL pass through to Obsidian unchanged.

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

---
### Requirement: Build and deploy into the vault

The project SHALL provide `npm run build`, which type-checks and bundles the plugin into `main.js` without any banner containing local filesystem paths, and `npm run deploy`, which runs the build and copies `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/project-dashboard/`. The vault path SHALL come from the environment variable `OBSIDIAN_VAULT`, or failing that from a git-ignored local config file, and `npm run deploy` SHALL exit with a non-zero status and a clear message when neither is set. When `<vault>/.obsidian` does not exist, `npm run deploy` SHALL exit with a non-zero status and print the missing path. `manifest.json` SHALL declare id `project-dashboard`, name `Project Dashboard`, and `isDesktopOnly: true`. `main.js` and `node_modules/` SHALL be ignored by git.

#### Scenario: Deploy copies the three plugin files

- **WHEN** the user runs `npm run deploy` with a valid vault path configured
- **THEN** `main.js`, `manifest.json`, and `styles.css` MUST exist under `<vault>/.obsidian/plugins/project-dashboard/`

#### Scenario: Deploy refuses a wrong vault path

- **GIVEN** `OBSIDIAN_VAULT=/tmp/not-a-vault`
- **WHEN** the user runs `npm run deploy`
- **THEN** the command MUST exit with a non-zero status
- **AND** it MUST print `/tmp/not-a-vault/.obsidian`

#### Scenario: Deploy refuses when no vault is configured

- **GIVEN** `OBSIDIAN_VAULT` is unset and no local config file exists
- **WHEN** the user runs `npm run deploy`
- **THEN** the command MUST exit with a non-zero status
- **AND** it MUST print a message explaining how to configure the vault path
