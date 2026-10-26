## MODIFIED Requirements

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
