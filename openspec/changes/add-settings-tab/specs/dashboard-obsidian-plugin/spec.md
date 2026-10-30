## MODIFIED Requirements

### Requirement: Projects are scanned from the vault project folder

The plugin SHALL read projects from the folder named by the `Project folder` setting (`projectFolder`, default `Projects`) and SHALL scan only Markdown files that are direct children of that folder. Files in subfolders (for example a `Task notes` subfolder) SHALL NOT be scanned. Files SHALL be processed in code-point order of their filenames. Every scan SHALL use the setting's value at the time of the scan. When the folder does not exist, the view SHALL display the message `找不到專案資料夾：<folder>` instead of a chart and SHALL NOT throw. When a single note cannot be read, the plugin SHALL skip that note, log the failure to the developer console, and render all other projects.

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

For every scanned note, the plugin scanner SHALL produce a project record with fields `name`, `category`, `color`, `status`, `start`, `end`, `promised_end`, `overflow_end`, `task_dates`, `tasks`, `occupied_weeks`, `settled_weeks`, and `warnings`, derived deterministically from the file's name, frontmatter, task lines, and the current settings. Notes whose cleaned name contains any entry of the `Projects to skip` setting SHALL be omitted. Status detection SHALL inspect the first three Unicode code points of the filename, so that astral emoji such as `🚧` are detected correctly.

#### Scenario: Representative records

- **WHEN** the scanner processes the inputs below with no overrides, the default settings, and today `2026-10-25`
- **THEN** the records MUST match the expected values

##### Example: filename and task derivations

| Filename / content | Expected |
| ------------------ | -------- |
| `🚧 P-20260413 ~ 1213 範例：家庭生活專案.md`, no frontmatter dates, no task dates | `status` = `active`, `start` = `2026-04-13`, `end` = `2026-12-13`, `warnings` = [`起日由檔名推得`, `迄日由檔名推得`], `category` = `life` |
| `✅ P-2026 範例：已完成專案.md` | `status` = `done`, `category` = `other` |
| line `- [ ] 確認拍攝服裝 📅 2026-10-30` | task `{ date: 2026-10-30, kind: planned, text: 確認拍攝服裝, done: false }`, occupied week `2026-W44` |
| line `- [ ] 盤點 📅 2026-10-31` (Saturday) | occupied week `2026-W44` with `Saturday tasks count for next week` off, `2026-W45` with it on; `promised_end` contribution `2026-10-31` either way |
| line `- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15` | both dates' weeks are settled when no other incomplete task shares them |

#### Scenario: Excluded project is omitted

- **GIVEN** the `Projects to skip` setting holds `範例草稿`
- **WHEN** the scanner processes `🚧 P-2026 範例草稿.md` and `🚧 P-2026 範例專案 A.md`
- **THEN** only `P-2026 範例專案 A` MUST produce a project record

---
### Requirement: Category overrides are stored in plugin data

The plugin SHALL store manual category overrides in its plugin data under `categoryOverrides`, as `{ <project full name>: <category key> }`, next to the `settings` object. Choosing a category in a row's category control SHALL write that entry; choosing `自動（清除覆寫）` SHALL delete the entry; a category key that is not one of `corporate`, `online_course`, `coaching`, `publishing`, `sponsorship`, `life`, `other` SHALL NOT be written. Saving an override SHALL keep `settings` unchanged. After a successful save the plugin SHALL re-scan, re-render, and show the toast `已更新分類`. When the save fails, the plugin SHALL show the error toast `分類儲存失敗，請再試一次`, restore the control to the project's actual category, and leave the stored overrides unchanged. Classification priority SHALL remain: exact full-name override, then the classification rules from the settings in list order (rules with empty text are skipped), then `other`. At most one toast SHALL be visible at a time.

#### Scenario: Override persists across restarts

- **GIVEN** the project `P-2026 範例專案 A` matches no classification rule and is classified as `other`
- **WHEN** the user turns on `編輯分類`, picks `生活` for that row, and relaunches Obsidian
- **THEN** the plugin data MUST contain `"P-2026 範例專案 A": "life"` under `categoryOverrides`
- **AND** the project MUST render in the `life` color and group

#### Scenario: Failed save reverts the control

- **GIVEN** writing plugin data fails
- **WHEN** the user picks a new category for a row
- **THEN** the toast `分類儲存失敗，請再試一次` MUST appear
- **AND** the row's control MUST show the project's actual category
