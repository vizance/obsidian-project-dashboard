# dashboard-keyboard-shortcuts Specification

## Purpose

Define the dashboard's keyboard shortcuts — view-mode toggle, help panel, and popover dismissal — and the conditions under which they are ignored.

## Requirements

### Requirement: Toggle view mode with T key

The dashboard SHALL register a global keydown handler that toggles the active view mode between `per-week` and `timeline` when the user presses the `T` key (case-insensitive). The handler SHALL ignore the keypress when ANY of the following conditions hold:

- The focused element's tag is `INPUT` or `TEXTAREA`.
- Any modifier key is held (`event.ctrlKey`, `event.metaKey`, or `event.altKey` is true).

When the toggle fires, the dashboard SHALL re-render the gantt chart using the new view mode without re-fetching `/data.json`, and SHALL persist the new view mode to `localStorage` under key `dashboard.viewMode` (value: literal string `'per-week'` or `'timeline'`). The view mode applies to the year view only: while the month view is shown, pressing `T` SHALL change nothing and SHALL NOT write `dashboard.viewMode`.

#### Scenario: T toggles between per-week and timeline

- **GIVEN** the dashboard is loaded with `viewMode = 'per-week'`
- **WHEN** the user presses the `T` key with no modifiers and no input focused
- **THEN** the gantt MUST re-render in timeline mode
- **AND** `localStorage.getItem('dashboard.viewMode')` MUST equal `'timeline'`
- **AND** no `/data.json` network request MUST be made

#### Scenario: Modifier keys do not trigger toggle

- **GIVEN** the dashboard is loaded
- **WHEN** the user presses `Ctrl+T` (or `Cmd+T` on macOS)
- **THEN** the view mode MUST NOT change
- **AND** the browser's native "open new tab" behavior MUST proceed (event MUST NOT be `preventDefault()`-ed for modifier combos)

#### Scenario: Input focus suppresses toggle

- **GIVEN** the focus is on the "顯示已結案" checkbox (or any `<input>` / `<textarea>` element)
- **WHEN** the user presses `T`
- **THEN** the view mode MUST NOT change

#### Scenario: Case-insensitive

- **GIVEN** the dashboard is loaded
- **WHEN** the user presses `t` (lowercase) OR `T` (uppercase, e.g. with caps lock)
- **THEN** the view mode MUST toggle in both cases

#### Scenario: T does nothing in the month view

- **GIVEN** the month view is shown and `dashboard.viewMode` is `'per-week'`
- **WHEN** the user presses `T` with no modifiers and no input focused
- **THEN** the month view MUST stay unchanged
- **AND** `dashboard.viewMode` MUST still equal `'per-week'`

---
### Requirement: Toggle help panel with ? key

The dashboard SHALL toggle the visibility of the help panel when the user presses `?` (typically Shift+/) OR `/` (without shift). The handler SHALL ignore the keypress under the same conditions as the view toggle (input/textarea focus, or any modifier key held — Shift alone is permitted for `?`).

When the toggle fires, the dashboard SHALL show or hide the help panel DOM element and persist the new state to `localStorage` under key `dashboard.helpPanelOpen` (value: literal string `'true'` or `'false'`).

#### Scenario: ? opens and closes the panel

- **GIVEN** the help panel is currently hidden
- **WHEN** the user presses `?` (Shift+/)
- **THEN** the help panel MUST become visible
- **AND** `localStorage.getItem('dashboard.helpPanelOpen')` MUST equal `'true'`
- **WHEN** the user presses `?` again
- **THEN** the help panel MUST become hidden
- **AND** `localStorage.getItem('dashboard.helpPanelOpen')` MUST equal `'false'`

#### Scenario: / alone also toggles

- **GIVEN** the help panel is currently hidden
- **WHEN** the user presses `/` (no shift)
- **THEN** the help panel MUST become visible

#### Scenario: Ctrl+? does not toggle

- **GIVEN** the dashboard is loaded
- **WHEN** the user presses `Ctrl+?` or `Cmd+?`
- **THEN** the help panel state MUST NOT change

---
### Requirement: Help panel content

The help panel SHALL display three sections with the following content:

- **Shortcuts section**: lists at minimum `T` (切換週視圖 / Timeline，只作用在年視圖), `M` (切換年 / 月), and `?` (顯示 / 隱藏面板).
- **Visual legend section**: explains the five visual states found in the gantt chart:
  - Solid filled block in category color → 該週有任務排定（尚未完成）
  - Dimmed category-color block with a checkmark (✓) → 該週任務已全部完成（settled）
  - Dashed border block in category color → 該週無任務（仍在專案區間）
  - Solid filled block in warning red → 超出原訂結束日（scope creep）— 該回去更新 frontmatter `預計結束日期`
  - Blank cell → 不在專案區間 / 已結案專案的無任務週
- **Month view section**: explains the task text styles of the month view:
  - `✓` before greyed text → 已完成的任務
  - Text in warning red → 週已過還沒完成的任務
  - Normal text → 還沒完成、週還沒過的任務

The help panel MUST be a static DOM structure (not dynamically generated from data) so its content is always available regardless of which projects are loaded.

#### Scenario: Panel contains both sections

- **WHEN** the help panel is visible
- **THEN** the DOM MUST contain at least one element matching the shortcuts section (e.g., a `<section class="shortcuts">` or equivalent identifier)
- **AND** the DOM MUST contain at least one element matching the visual legend section
- **AND** the shortcuts section MUST include literal text matching `T` and `?` (or `/`)
- **AND** the visual legend section MUST include the substring `超出原訂結束日` (or equivalent explanation of the red color)

#### Scenario: Legend includes the settled state

- **WHEN** the help panel is visible
- **THEN** the visual legend section MUST include an entry explaining the settled state (a dimmed category-color block with a checkmark) with text matching `已全部完成` (or equivalent)

#### Scenario: Panel explains the month view

- **WHEN** the help panel is visible
- **THEN** the shortcuts section MUST include literal text matching `M`
- **AND** the panel MUST include the substring `週已過還沒完成`

---
### Requirement: Persistent reopen affordance (help FAB)

The dashboard SHALL render a small persistent floating action button (FAB) in the bottom-right corner of the viewport whenever the help panel is hidden. Clicking the FAB SHALL open the help panel (equivalent to pressing `?`). When the help panel is visible, the FAB SHALL be hidden to avoid visual redundancy. The FAB exists so that users who close the help panel without remembering the `?` shortcut still have a discoverable way to reopen it.

#### Scenario: FAB visible when panel hidden

- **GIVEN** the help panel is hidden
- **WHEN** the user looks at the bottom-right of the viewport
- **THEN** a button (e.g., `#help-fab`) displaying a question-mark glyph MUST be visible
- **AND** the button MUST have an accessible label or `title` attribute that explains its function in Traditional Chinese

#### Scenario: Clicking FAB opens the panel

- **GIVEN** the help panel is hidden and the FAB is visible
- **WHEN** the user clicks the FAB
- **THEN** the help panel MUST become visible
- **AND** the FAB MUST become hidden
- **AND** `localStorage.getItem('dashboard.helpPanelOpen')` MUST equal `'true'`

#### Scenario: FAB hides when panel opens via shortcut

- **GIVEN** the help panel is hidden and the FAB is visible
- **WHEN** the user presses `?` (opening the panel via shortcut)
- **THEN** the help panel MUST become visible
- **AND** the FAB MUST become hidden

---
### Requirement: First-time help panel auto-show

On the first dashboard load for a given browser (detected by the absence of `localStorage` key `dashboard.helpFirstSeen`), the help panel SHALL automatically display itself and the dashboard SHALL write the string `'true'` to that key. Subsequent loads SHALL respect the persisted `dashboard.helpPanelOpen` value.

#### Scenario: First visit shows panel automatically

- **GIVEN** `localStorage.getItem('dashboard.helpFirstSeen')` is `null` (key absent)
- **WHEN** the dashboard finishes loading
- **THEN** the help panel MUST be visible
- **AND** `localStorage.getItem('dashboard.helpFirstSeen')` MUST equal `'true'`

#### Scenario: Subsequent visits honor saved state

- **GIVEN** `localStorage.getItem('dashboard.helpFirstSeen')` equals `'true'`
- **AND** `localStorage.getItem('dashboard.helpPanelOpen')` equals `'false'`
- **WHEN** the dashboard finishes loading
- **THEN** the help panel MUST be hidden

#### Scenario: Subsequent visit with no explicit close

- **GIVEN** `localStorage.getItem('dashboard.helpFirstSeen')` equals `'true'`
- **AND** `localStorage.getItem('dashboard.helpPanelOpen')` is `null`
- **WHEN** the dashboard finishes loading
- **THEN** the help panel MUST be hidden (treat missing key as last-closed state)

---
### Requirement: localStorage persistence is graceful

When `localStorage` is unavailable (e.g., browser privacy mode that throws on access), the dashboard SHALL continue to function with in-memory defaults for the current session. The dashboard MUST NOT throw an uncaught exception or fail to render due to localStorage access failure.

#### Scenario: localStorage throws are caught

- **GIVEN** the browser environment causes `localStorage.getItem` or `localStorage.setItem` to throw
- **WHEN** the dashboard loads, the user toggles view mode, or toggles the help panel
- **THEN** no uncaught exception MUST propagate to the global error handler
- **AND** the dashboard MUST render with default view mode `'per-week'` and the help panel auto-visible (treated as "first visit" fallback)
