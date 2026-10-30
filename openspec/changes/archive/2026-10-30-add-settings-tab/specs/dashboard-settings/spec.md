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

The plugin SHALL register a settings tab. Its text SHALL be plain English that a fifth-grade student can read: short sentences, common words, no technical terms. The dashboard itself (year view and week popover) SHALL keep its Traditional Chinese text; the category names in the tab SHALL be the same Chinese category labels the dashboard shows, and the classification rule texts are user data that SHALL be shown as stored. The tab SHALL contain three sections in this order.

`Project notes`:

- `Project folder`: a text field holding `projectFolder`, described as `The folder where your project notes live. Only notes right inside this folder are used. Notes in folders inside it are skipped.`. When no folder with that path exists in the vault, the text `Can't find this folder.` SHALL be shown under the field.
- `Projects to skip`: a multi-line text field holding `excludedProjects`, one entry per line, described as `Write one word or phrase on each line. A note whose name has any of them will not show on the dashboard.`.

`Categories`:

- The description `If a project's name has the words on the left, it goes into the category on the right. The rules are checked from top to bottom, and the first one that matches wins. A category you pick by hand on the dashboard always beats these rules.`
- One row per stored classification rule, in the stored order, including rules whose text is empty, so that the rows and the stored list always correspond one to one. Each row has a text field (placeholder `Words in the name…`), a category dropdown listing the seven category labels, and three buttons labelled `Move up`, `Move down`, and `Delete`, which move or remove that rule in the stored list. `Move up` SHALL be disabled on the first row and `Move down` on the last row.
- A button `Add a rule` that appends a rule with empty text and category `other`. Such a rule SHALL survive saving and reloading and SHALL NOT take part in classification until its text is filled in.

`Dates`:

- `Which day to write`: a dropdown of `Monday` to `Sunday` holding `scheduleWeekday`, described as `When you add a task to a week from the week pop-up, the note gets this day of that week as the task's date.`. Choosing an option SHALL store the integer 1 (`Monday`) to 7 (`Sunday`), never the option's text or a numeric string.
- `Saturday tasks count for next week`: a toggle holding `saturdayCountsAsNextWeek`, described as `Turn this on if you plan next week on Saturday. Then a task with a Saturday date shows up in the week after.`.

The `Can't find this folder.` hint SHALL be evaluated against the normalized folder, so an emptied field is checked as `Projects`.

#### Scenario: Moving a rule up changes the result

- **GIVEN** the rules are `課程` → `online_course` then `內訓` → `corporate`, and a project named `P-2026 範例內訓課程`
- **WHEN** the user presses `Move up` on the `內訓` row
- **THEN** after the change is applied the project MUST be classified as `corporate`

#### Scenario: Missing folder hint

- **WHEN** the user types `Projets` into `Project folder` and no such folder exists
- **THEN** the tab MUST show `Can't find this folder.` under the field

#### Scenario: Emptied folder falls back to the default

- **GIVEN** the vault has a folder `Projects` with project notes
- **WHEN** the user clears `Project folder` and the change is applied
- **THEN** the plugin data MUST hold `projectFolder` `Projects`
- **AND** the dashboard MUST show the projects from `Projects` without the `Can't find this folder.` hint

#### Scenario: A new empty rule survives a save

- **WHEN** the user presses `Add a rule`, the change is saved, and Obsidian is relaunched
- **THEN** the tab MUST still show the empty rule as the last row
- **AND** classification of every project MUST be the same as before the rule was added

#### Scenario: Saturday is stored as a number

- **WHEN** the user picks `Saturday` in `Which day to write` and the change is saved
- **THEN** the plugin data MUST hold `"scheduleWeekday": 6`

---
### Requirement: Settings changes apply to open dashboards

Every change made in the settings tab SHALL be saved to plugin data and applied 400 ms after the most recent change in the tab, so that a burst of edits produces exactly one save and one re-scan. After a successful save every open dashboard tab SHALL re-scan and re-render with the new settings without being reopened. When the save fails, the plugin SHALL show the notice `Your settings couldn't be saved. Please try again.`, restore the settings to the last successfully saved values, and redraw the settings tab with them.

#### Scenario: Changing the folder rescans the dashboard

- **GIVEN** a dashboard tab is open and the vault has a folder `Work/Projects` with project notes
- **WHEN** the user sets `Project folder` to `Work/Projects` and stops typing
- **THEN** within 1 second the dashboard MUST show the projects from `Work/Projects`

#### Scenario: Turning on the Saturday rule moves Saturday tasks

- **GIVEN** a project note contains `- [ ] 盤點 📅 2026-10-31` (Saturday) and the dashboard shows it in `2026-W44`
- **WHEN** the user turns on `Saturday tasks count for next week`
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

- **GIVEN** the user changed `Which day to write` to `Monday` less than 400 ms ago, so the save is still pending
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
