# dashboard-category-override Specification

## Purpose

Let the user manually assign a project's category from the dashboard UI, override the automatic keyword classification for that one project, and give visible feedback on whether the change was saved.

## Requirements

### Requirement: Manual category override persisted

The dashboard SHALL let the user manually assign a project's category from the UI, and SHALL persist that assignment keyed by the project's full name (the `stripStatus`-cleaned project name) mapped to a category key that exists in `CATEGORIES`. When no override is stored for a project, the system SHALL treat it as unset and continue scanning normally.

#### Scenario: Override survives re-scan and restart

- **GIVEN** a project `P-2026 範例：家庭生活專案 @小明 @小美` that the keyword classifier would place in `other`
- **WHEN** the user assigns it to the `life` category in the UI
- **THEN** the stored overrides MUST contain an entry mapping that project's full name to `"life"`
- **AND** after the next re-scan (or restart) the project MUST still be categorized as `life`

#### Scenario: Missing override store is not an error

- **GIVEN** no overrides are stored
- **WHEN** the scanner runs
- **THEN** classification MUST proceed using the existing rules with no error

---
### Requirement: Override applied at highest classification priority by exact name

The scanner's `classify` step SHALL apply the override store at the HIGHEST priority, matching the project's full name EXACTLY. The classification order SHALL be: (1) exact-name override hit → its category; otherwise (2) `MANUAL_OVERRIDES` substring rules; otherwise (3) keyword rules; otherwise (4) `other`. An override SHALL affect only the exact project whose full name matches its key, and MUST NOT affect other projects that merely share a name fragment.

#### Scenario: Exact-name override beats keyword classification

- **GIVEN** an override entry `{ "P-2026 範例：家庭生活專案 @小明 @小美": "life" }`
- **WHEN** the scanner classifies that project
- **THEN** its category MUST be `life`, regardless of keyword matches

#### Scenario: Override does not leak to fragment-sharing projects

- **GIVEN** an override only for the exact project `P-2026 範例：家庭生活專案 @小明 @小美`
- **AND** another project whose name also contains `家庭生活專案` but is NOT overridden
- **WHEN** the scanner classifies both
- **THEN** only the exact-named project MUST take the override category
- **AND** the other `家庭生活專案` project MUST be classified by the normal rules

---
### Requirement: Saving an override validates the category and writes atomically

Saving an override SHALL accept a project's full name and a category key, or `null`/empty to clear it. When the category is a valid `CATEGORIES` key, the save SHALL write/update that project's entry; when the category is `null` or empty, the save SHALL remove that project's entry (reverting to automatic classification). When the category is non-null and not a known `CATEGORIES` key, the save SHALL be rejected and MUST NOT modify the stored overrides. A write SHALL be atomic, so a concurrent or interrupted save cannot corrupt the override store.

#### Scenario: Valid assignment is written

- **WHEN** the user assigns project `P-2026 範例：家庭生活專案 @小明 @小美` to category `life`
- **THEN** the save MUST succeed
- **AND** the stored overrides MUST contain that project mapped to `"life"`

#### Scenario: Clearing an override removes the entry

- **GIVEN** an existing override for a project
- **WHEN** the user clears it
- **THEN** the project's entry MUST be removed from the stored overrides
- **AND** the project MUST revert to its automatically classified category on the next scan

#### Scenario: Unknown category is rejected

- **WHEN** a save is attempted with category `"not-a-real-category"`
- **THEN** the save MUST be rejected
- **AND** the stored overrides MUST NOT be modified

---
### Requirement: Per-row category control in the UI

The dashboard SHALL render, in each project row, a control that lets the user pick the project's category from the existing categories plus an "automatic (clear override)" option. The control's current value SHALL reflect the project's current category. Changing the control SHALL save the override, and on success SHALL re-scan and re-render so the project immediately reflects the new category (color and legend grouping).

#### Scenario: Changing the control re-categorizes the project immediately

- **GIVEN** a project currently shown as `other`
- **WHEN** the user picks `生活` (life) from that row's category control
- **THEN** the override MUST be saved for that project with category `life`
- **AND** after the subsequent re-scan the project MUST render in the `life` color and group

#### Scenario: Selecting automatic clears the override

- **GIVEN** a project with an active override
- **WHEN** the user picks the "automatic (clear override)" option
- **THEN** the override MUST be cleared
- **AND** the project MUST revert to its automatically classified category after the re-scan

---
### Requirement: Category editor visibility toggle

The per-row category control (`.cat-select`) SHALL be hidden by default so the default dashboard view stays uncluttered. The header SHALL provide a checkbox labelled to indicate category editing (alongside the existing "顯示已結案" checkbox). When the checkbox is checked, all per-row category controls SHALL become visible; when unchecked, they SHALL be hidden. The toggle SHALL be implemented purely in the frontend by adding/removing a CSS class (e.g., `editing-categories`) on a container element, controlling `.cat-select` visibility via CSS — it MUST NOT re-scan or re-render the chart. The toggle state SHALL NOT be persisted: every fresh load of the dashboard SHALL start with the controls hidden (checkbox unchecked).

#### Scenario: Controls hidden by default

- **GIVEN** the dashboard is loaded fresh
- **THEN** the per-row category controls MUST be hidden
- **AND** the header category-editing checkbox MUST be unchecked

#### Scenario: Checking the box reveals the controls

- **WHEN** the user checks the category-editing checkbox
- **THEN** every project row's category control MUST become visible
- **AND** no re-scan MUST be triggered (visibility changes via CSS only)

#### Scenario: Unchecking hides them again

- **GIVEN** the category-editing checkbox is checked and controls are visible
- **WHEN** the user unchecks it
- **THEN** all per-row category controls MUST be hidden again

#### Scenario: State resets on reload

- **GIVEN** the user checked the category-editing checkbox in a previous session
- **WHEN** the dashboard is loaded fresh
- **THEN** the controls MUST be hidden and the checkbox unchecked (state not persisted)

---
### Requirement: Visible feedback on category save

When the user changes a project's category control, the dashboard SHALL give visible feedback on the outcome of the save instead of failing silently. On success, the dashboard SHALL show a brief, auto-dismissing toast confirming the save (e.g., "已更新分類") and then re-scan and re-render. On failure, the dashboard SHALL show a visible error toast whose text names the likely cause (e.g. "分類儲存失敗，請再試一次"), AND SHALL restore the row's category control to the project's actual current category (so the UI never shows an applied change that was not persisted). At most one toast SHALL be visible at a time.

#### Scenario: Successful save shows confirmation

- **WHEN** the user changes a project's category and the save succeeds
- **THEN** a brief confirmation toast MUST appear and auto-dismiss
- **AND** the chart MUST re-render reflecting the new category

#### Scenario: Failed save shows error and reverts the control

- **GIVEN** the save fails
- **WHEN** the user changes a project's category
- **THEN** a visible error toast MUST appear naming the likely cause
- **AND** the row's category control MUST be restored to the project's actual current category
- **AND** the change MUST NOT appear applied in the UI

#### Scenario: Only one toast at a time

- **WHEN** two category saves happen in quick succession
- **THEN** at most one toast MUST be visible at any moment (a newer toast replaces the previous one)
