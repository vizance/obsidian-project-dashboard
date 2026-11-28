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

The help panel SHALL organize its content into three tabs labelled `年視圖`, `月視圖`, and `操作`, shown at the top of the panel. Only the selected tab's content SHALL be shown. The selected tab SHALL be marked by at least two cues (bold label and an accent-colored underline), and the tabs SHALL be keyboard accessible (`role="tablist"`/`tab`/`tabpanel`, arrow keys move between tabs). Each time the panel opens, the selected tab SHALL be `年視圖` when the year view is shown and `月視圖` when the month view is shown; clicking a tab switches to it. Within a tab, items SHALL be grouped under short subheadings, one short line per item, and every visual item SHALL show a sample drawn with the same classes the chart uses.

`年視圖` SHALL contain these groups and items:

- **每一格＝這週的任務**:
  - Solid filled block in category color → 有任務，還沒全部完成
  - Dimmed block with a checkmark (✓) → 這週的任務都完成了
  - Dashed border block → 在專案期間內，這週沒有任務
  - Blank cell → 沒有任務，也不在專案期間（或專案已結案）
- **需要注意**:
  - Solid block in warning red → 超出預計結束日期還有任務；可以更新 frontmatter 的 `預計結束日期`
  - `⚠` after a project name → 日期有缺漏、是推算的，或有問題；滑過去看原因
- **整列＝專案狀態**:
  - Diagonal stripes with the label `⏳ 暫停` → 暫停的專案（勾「顯示暫停」才會出現）
  - Grey block → 已完成或取消的專案（勾「顯示已結案」才會出現）
- **顏色與欄位**:
  - Category-colored dot → 專案的分類，對照上方圖例
  - Light red column → 今天所在的週
  - Narrow grey column under `Q1 ▸` → 折起來的一季；點季標題展開或折起

`月視圖` SHALL contain these groups and items:

- **格子裡的任務文字**:
  - `✓` before greyed text → 已完成的任務
  - Text in warning red → 週已過還沒完成的任務
  - Normal text → 還沒完成、週還沒過的任務
- **格子底色**:
  - One line → 底色的意思和年視圖一樣（實心、淡色、虛線、紅色、斜線紋）
- **General 列（行事曆）**:
  - A colored label before an event → 行事曆名稱；顏色在設定頁改
  - `↻` → 重新讀取行事曆；行程只能看，不能改
- **還沒排**:
  - The `還沒排` number → 還沒排日期的任務；點一下排進這個月的某一週

`操作` SHALL contain these groups and items:

- **編輯**:
  - 點格子 → 打開那一週的任務：勾完成、換週、排進或新增任務
  - 點專案名稱 → 在右側開啟筆記
  - 勾「編輯分類與狀態」 → 改專案的分類，或改成暫停、完成、取消
- **切換**:
  - `年` / `月`，或按 `M` → 切換年視圖與月視圖
  - `◀` `▶` → 換年份或月份；`本週`、`本月` 回到現在
  - `T` → 切換逐週與 Timeline（只在年視圖）
  - `?` → 打開或關閉這個面板
- **版面**:
  - 點圖例 → 把一類置頂；拖拉圖例 → 調整分類順序
  - 拖拉專案欄的右邊 → 調整欄寬
  - 點季標題（例如 `Q1`） → 折起或展開那一季（只在年視圖）

When the panel is taller than the window, it SHALL scroll inside itself and SHALL NOT extend past the window. The help panel MUST be a static DOM structure (not dynamically generated from data) so its content is always available regardless of which projects are loaded.

#### Scenario: The panel opens on the tab of the current view

- **GIVEN** the month view is shown
- **WHEN** the user presses `?`
- **THEN** the `月視圖` tab MUST be selected and its content shown
- **AND** the `年視圖` and `操作` content MUST be hidden

#### Scenario: Switching tabs

- **GIVEN** the help panel is open on `年視圖`
- **WHEN** the user clicks `操作`
- **THEN** the `操作` content MUST be shown and contain `編輯分類與狀態` and `M`
- **AND** the `年視圖` content MUST be hidden

#### Scenario: Year tab groups

- **WHEN** the `年視圖` tab is shown
- **THEN** it MUST show the subheadings `每一格＝這週的任務`, `需要注意`, `整列＝專案狀態`, and `顏色與欄位`
- **AND** it MUST include `⏳ 暫停`, `暫停的專案`, `超出預計結束日期`, and `折起來的一季`

#### Scenario: Month tab groups

- **WHEN** the `月視圖` tab is shown
- **THEN** it MUST include `週已過還沒完成`, `還沒排`, and `行事曆名稱`

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
