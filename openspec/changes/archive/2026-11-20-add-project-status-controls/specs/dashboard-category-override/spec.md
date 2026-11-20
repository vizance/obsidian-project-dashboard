## ADDED Requirements

### Requirement: Changing a project's status from the dashboard

While `編輯分類與狀態` is checked, each project row SHALL show, next to its category control, a status control (`.status-select`) with the options `🚧 進行中`, `⏳ 暫停`, `✅ 完成`, and `❌ 取消`, showing the project's current status (a filename without a status symbol counts as `🚧 進行中`). Choosing a different option SHALL rename the project note through Obsidian's file manager, so links to it are updated according to the user's Obsidian settings. The new filename SHALL be the old filename with its leading status symbol — a status symbol among its first three characters, together with the spaces right after it — replaced by the chosen symbol and one space; when the old filename has no leading status symbol, the chosen symbol and one space SHALL be put in front. The rest of the filename, including any status symbol later in the name, SHALL stay unchanged, and the note SHALL stay in the same folder. Manual category choices SHALL be kept, because they are stored under the name without status symbols.

When a note with the new filename already exists, the note SHALL NOT be renamed, the toast `已經有同名的筆記，狀態沒有改` SHALL be shown, and the control SHALL return to the current status. When the note no longer exists, the dashboard's existing missing-note toast SHALL be shown. After a successful rename the dashboard SHALL re-scan as for any note rename; if the project is now hidden (paused or closed while its toggle is off), its row and any popover open for it SHALL disappear.

#### Scenario: Pausing and resuming a project

- **GIVEN** `編輯分類與狀態` is checked and the note `🚧 P-20260824 範例專案.md` is shown
- **WHEN** the user picks `⏳ 暫停` in its status control
- **THEN** the note MUST be renamed to `⏳ P-20260824 範例專案.md` in the same folder
- **AND** with `顯示暫停` unchecked its row MUST disappear and `顯示暫停（1）` MUST be shown
- **WHEN** the user checks `顯示暫停（1）` and picks `🚧 進行中` for that row
- **THEN** the note MUST be renamed back to `🚧 P-20260824 範例專案.md`

##### Example: new filename

| Old filename | Chosen | New filename |
| ------------ | ------ | ------------ |
| `⏳ P-20260824 範例專案.md` | `🚧 進行中` | `🚧 P-20260824 範例專案.md` |
| `P-20260824 範例專案.md` | `⏳ 暫停` | `⏳ P-20260824 範例專案.md` |
| `🚧  P-20260824 範例專案.md` | `✅ 完成` | `✅ P-20260824 範例專案.md` |
| `🚧 P-20260824 範例 ✅ 檢查表.md` | `❌ 取消` | `❌ P-20260824 範例 ✅ 檢查表.md` |

#### Scenario: A name collision changes nothing

- **GIVEN** both `🚧 P-20260824 範例專案.md` and `✅ P-20260824 範例專案.md` exist
- **WHEN** the user picks `✅ 完成` for the first one
- **THEN** no note MUST be renamed
- **AND** the toast `已經有同名的筆記，狀態沒有改` MUST be shown and the control MUST show `🚧 進行中` again

## MODIFIED Requirements

### Requirement: Category editor visibility toggle

The per-row category control (`.cat-select`) SHALL be hidden by default so the default dashboard view stays uncluttered. The header SHALL provide a checkbox labelled `編輯分類與狀態` (alongside the existing "顯示已結案" checkbox). When the checkbox is checked, all per-row category controls and all per-row status controls (`.status-select`, see "Changing a project's status from the dashboard") SHALL become visible; when unchecked, they SHALL be hidden. The toggle SHALL be implemented purely in the frontend by adding/removing a CSS class (e.g., `editing-categories`) on a container element, controlling `.cat-select` and `.status-select` visibility via CSS — it MUST NOT re-scan or re-render the chart. The toggle state SHALL NOT be persisted: every fresh load of the dashboard SHALL start with the controls hidden (checkbox unchecked).

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

