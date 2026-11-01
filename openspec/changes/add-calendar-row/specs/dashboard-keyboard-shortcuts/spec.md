## MODIFIED Requirements

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
  - The General row → 行事曆的行程，只能看；按 `↻` 重新讀取

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

