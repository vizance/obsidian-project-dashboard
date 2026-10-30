## ADDED Requirements

### Requirement: Settings are stored in plugin data with validated defaults

The plugin SHALL keep its settings in the plugin data object under the key `settings`, next to the existing `categoryOverrides` key:

```json
{
  "categoryOverrides": { "<project full name>": "<category key>" },
  "settings": {
    "projectFolder": "Projects",
    "classificationRules": [{ "text": "內訓", "category": "corporate" }],
    "excludedProjects": [],
    "scheduleWeekday": 5,
    "saturdayCountsAsNextWeek": false
  }
}
```

The plugin SHALL normalize each field on its own, so that one invalid field never discards the others. The same normalization SHALL apply when plugin data is loaded, when it is reloaded after an outside change, to every value written to plugin data, and to the settings used for scanning; the dashboard therefore never scans with a value that the stored data could not hold:

- `projectFolder`: a string, trimmed, with leading and trailing `/` removed; a missing, non-string, or empty result SHALL become `Projects`.
- `classificationRules`: when the key is missing or not an array, the default rules below SHALL be used. When it is an array, every entry whose `text` is a string and whose `category` is one of `corporate`, `online_course`, `coaching`, `publishing`, `sponsorship`, `life`, `other` SHALL be kept in order with its `text` trimmed, including entries whose trimmed `text` is empty; every other entry SHALL be dropped. An empty array SHALL stay empty. Entries with empty `text` are kept so that a rule the user has just added survives saving; classification skips them.
- `excludedProjects`: string entries, trimmed, with empty entries dropped; a missing or non-array value SHALL become `[]`.
- `scheduleWeekday`: an integer from 1 (Monday) to 7 (Sunday); any other value SHALL become `5` (Friday).
- `saturdayCountsAsNextWeek`: a boolean; any other value SHALL become `false`.

The default classification rules SHALL be, in order: `企業內訓` → `corporate`, `內訓` → `corporate`, `線上課程` → `online_course`, `課程` → `online_course`, `出版` → `publishing`, `教練` → `coaching`, `諮詢` → `coaching`, `業配` → `sponsorship`, `合作` → `sponsorship`, `生活` → `life`.

#### Scenario: First run uses the defaults

- **GIVEN** the plugin data has no `settings` key
- **WHEN** the plugin loads
- **THEN** the settings MUST be `projectFolder` `Projects`, the ten default classification rules, `excludedProjects` `[]`, `scheduleWeekday` `5`, and `saturdayCountsAsNextWeek` `false`

##### Example: field normalization

| Stored value | Loaded value |
| ------------ | ------------ |
| `"projectFolder": "/Work/Projects/ "` | `"Work/Projects"` |
| `"projectFolder": ""` | `"Projects"` |
| `"classificationRules": [{ "text": " 課程 ", "category": "online_course" }, { "text": "", "category": "life" }, { "text": "合作", "category": "unknown" }, { "text": 3, "category": "life" }]` | `[{ "text": "課程", "category": "online_course" }, { "text": "", "category": "life" }]` |
| `"classificationRules": []` | `[]` |
| `"classificationRules": "課程"` | the ten default rules |
| `"excludedProjects": [" 範例草稿 ", "", 3]` | `["範例草稿"]` |
| `"scheduleWeekday": 6` | `6` |
| `"scheduleWeekday": 0`, `8`, `2.5`, or `"5"` | `5` |
| `"saturdayCountsAsNextWeek": "yes"` | `false` |

---
### Requirement: Settings tab

The plugin SHALL register a settings tab. Its text SHALL be Traditional Chinese, and it SHALL contain three sections in this order.

`專案筆記`:

- `專案資料夾`: a text field holding `projectFolder`, described as `vault 裡放專案筆記的資料夾，只讀這一層，不含子資料夾。`. When no folder with that path exists in the vault, the text `找不到這個資料夾` SHALL be shown under the field.
- `不列入的專案`: a multi-line text field holding `excludedProjects`, one entry per line, described as `檔名包含這些文字的筆記不會出現在儀表板，一行一個。`.

`分類`:

- The description `專案名稱包含左邊的文字，就歸到右邊的分類。由上往下比對，第一個符合的規則生效；在儀表板上手動指定的分類優先於這些規則。`
- One row per stored classification rule, in the stored order, including rules whose text is empty, so that the rows and the stored list always correspond one to one. Each row has a text field (placeholder `名稱包含…`), a category dropdown listing the seven category labels, and three buttons labelled `上移`, `下移`, and `刪除`, which move or remove that rule in the stored list. `上移` SHALL be disabled on the first row and `下移` on the last row.
- A button `新增分類規則` that appends a rule with empty text and category `other`. Such a rule SHALL survive saving and reloading and SHALL NOT take part in classification until its text is filled in.

`日期規則`:

- `排進某週時寫星期幾`: a dropdown of `星期一` to `星期日` holding `scheduleWeekday`, described as `從浮窗把任務排進某一週或新增任務時，寫入那週的這一天。`. Choosing an option SHALL store the integer 1 (`星期一`) to 7 (`星期日`), never the option's text or a numeric string.
- `週六的任務算到下一週`: a toggle holding `saturdayCountsAsNextWeek`, described as `開啟後，日期寫週六的任務會顯示在下一週，代表「週六先排好下週要做的事」。`.

The `找不到這個資料夾` hint SHALL be evaluated against the normalized folder, so an emptied field is checked as `Projects`.

#### Scenario: Moving a rule up changes the result

- **GIVEN** the rules are `課程` → `online_course` then `內訓` → `corporate`, and a project named `P-2026 範例內訓課程`
- **WHEN** the user presses `上移` on the `內訓` row
- **THEN** after the change is applied the project MUST be classified as `corporate`

#### Scenario: Missing folder hint

- **WHEN** the user types `Projets` into `專案資料夾` and no such folder exists
- **THEN** the tab MUST show `找不到這個資料夾` under the field

#### Scenario: Emptied folder falls back to the default

- **GIVEN** the vault has a folder `Projects` with project notes
- **WHEN** the user clears `專案資料夾` and the change is applied
- **THEN** the plugin data MUST hold `projectFolder` `Projects`
- **AND** the dashboard MUST show the projects from `Projects` without the `找不到這個資料夾` hint

#### Scenario: A new empty rule survives a save

- **WHEN** the user presses `新增分類規則`, the change is saved, and Obsidian is relaunched
- **THEN** the tab MUST still show the empty rule as the last row
- **AND** classification of every project MUST be the same as before the rule was added

#### Scenario: Saturday is stored as a number

- **WHEN** the user picks `星期六` in `排進某週時寫星期幾` and the change is saved
- **THEN** the plugin data MUST hold `"scheduleWeekday": 6`

---
### Requirement: Settings changes apply to open dashboards

Every change made in the settings tab SHALL be saved to plugin data and applied 400 ms after the most recent change in the tab, so that a burst of edits produces exactly one save and one re-scan. After a successful save every open dashboard tab SHALL re-scan and re-render with the new settings without being reopened. When the save fails, the plugin SHALL show the notice `設定儲存失敗，請再試一次`, restore the settings to the last successfully saved values, and redraw the settings tab with them.

#### Scenario: Changing the folder rescans the dashboard

- **GIVEN** a dashboard tab is open and the vault has a folder `Work/Projects` with project notes
- **WHEN** the user sets `專案資料夾` to `Work/Projects` and stops typing
- **THEN** within 1 second the dashboard MUST show the projects from `Work/Projects`

#### Scenario: Turning on the Saturday rule moves Saturday tasks

- **GIVEN** a project note contains `- [ ] 盤點 📅 2026-10-31` (Saturday) and the dashboard shows it in `2026-W44`
- **WHEN** the user turns on `週六的任務算到下一週`
- **THEN** after the change is applied the dashboard MUST show that task in `2026-W45` and not in `2026-W44`

---
### Requirement: Saving one part of plugin data keeps the other

Every write of plugin data SHALL write the whole object. Saving a category override SHALL leave `settings` unchanged, and saving settings SHALL leave `categoryOverrides` unchanged.

#### Scenario: Category override save keeps the settings

- **GIVEN** the settings hold `projectFolder` `Work/Projects`
- **WHEN** the user assigns a project's category from the dashboard
- **THEN** the plugin data MUST still hold `projectFolder` `Work/Projects`
- **AND** it MUST contain the new category override

---
### Requirement: Settings changed outside Obsidian's settings tab are reloaded

When Obsidian reports that the plugin data changed outside the running plugin (for example after Obsidian Sync brings changes made on another device), the plugin SHALL cancel any pending save from the settings tab, reload and normalize the plugin data, re-scan and re-render every open dashboard tab, and redraw the settings tab when it is open. The reloaded values SHALL win: a local edit that was still waiting to be saved SHALL be discarded and SHALL NOT be written afterwards.

#### Scenario: Synced folder change

- **GIVEN** a dashboard tab is open with `projectFolder` `Projects`
- **WHEN** synced plugin data arrives with `projectFolder` `Work/Projects`
- **THEN** the dashboard MUST re-render with the projects from `Work/Projects`

#### Scenario: Synced data arriving during a pending edit wins

- **GIVEN** the user changed `排進某週時寫星期幾` to `星期一` less than 400 ms ago, so the save is still pending
- **WHEN** synced plugin data arrives with `scheduleWeekday` `5`
- **THEN** the settings MUST hold `5` after the reload
- **AND** no later save MUST write `1`

---
### Requirement: Configuration needs no rebuild

A user who installs the release files `main.js`, `manifest.json`, and `styles.css` SHALL be able to set every option of this capability from the settings tab, without editing or rebuilding source code. Building, testing, and linting the repository SHALL NOT read or create any git-ignored source file.

#### Scenario: Fresh clone builds without local files

- **WHEN** a maintainer runs `npm ci`, `npm test`, `npm run lint`, and `npm run build` in a fresh clone
- **THEN** all four MUST succeed
- **AND** no new file MUST appear under `src/`
