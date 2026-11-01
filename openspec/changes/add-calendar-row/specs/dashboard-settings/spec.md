## MODIFIED Requirements

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
    "saturdayCountsAsNextWeek": false,
    "calendars": [{ "name": "工作", "secretId": "work-calendar" }]
  }
}
```

The plugin SHALL normalize each field on its own, so that one invalid field never discards the others. The same normalization SHALL apply when plugin data is loaded, when it is reloaded after an outside change, to every value written to plugin data, and to the settings used for scanning; the dashboard therefore never scans with a value that the stored data could not hold:

- `projectFolder`: a string, trimmed, with leading and trailing `/` removed; a missing, non-string, or empty result SHALL become `Projects`.
- `classificationRules`: when the key is missing or not an array, the default rules below SHALL be used. When it is an array, every entry whose `text` is a string and whose `category` is one of `corporate`, `online_course`, `coaching`, `publishing`, `sponsorship`, `life`, `other` SHALL be kept in order with its `text` trimmed, including entries whose trimmed `text` is empty; every other entry SHALL be dropped. An empty array SHALL stay empty. Entries with empty `text` are kept so that a rule the user has just added survives saving; classification skips them.
- `excludedProjects`: string entries, trimmed, with empty entries dropped; a missing or non-array value SHALL become `[]`.
- `scheduleWeekday`: an integer from 1 (Monday) to 7 (Sunday); any other value SHALL become `5` (Friday).
- `saturdayCountsAsNextWeek`: a boolean; any other value SHALL become `false`.
- `calendars`: a list of calendars, each `{ "name": <string>, "secretId": <string> }`. Every entry that is an object SHALL be kept in order, with `name` and `secretId` trimmed and any missing or non-string `name` or `secretId` becoming `""`; entries with empty `name` or empty `secretId` SHALL be kept, so that a calendar the user has just added survives saving. Every other entry SHALL be dropped. A missing or non-array value SHALL become `[]`. The calendar's address is never part of plugin data; `secretId` names the entry in Obsidian's secret storage that holds it (see `dashboard-calendar-row`).

The default classification rules SHALL be, in order: `企業內訓` → `corporate`, `內訓` → `corporate`, `線上課程` → `online_course`, `課程` → `online_course`, `出版` → `publishing`, `教練` → `coaching`, `諮詢` → `coaching`, `業配` → `sponsorship`, `合作` → `sponsorship`, `生活` → `life`.

#### Scenario: First run uses the defaults

- **GIVEN** the plugin data has no `settings` key
- **WHEN** the plugin loads
- **THEN** the settings MUST be `projectFolder` `Projects`, the ten default classification rules, `excludedProjects` `[]`, `scheduleWeekday` `5`, `saturdayCountsAsNextWeek` `false`, and `calendars` `[]`

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
| `"calendars": [{ "name": " 工作 ", "secretId": " work-calendar " }, { "name": "", "secretId": "" }, { "name": 3 }, "工作", null]` | `[{ "name": "工作", "secretId": "work-calendar" }, { "name": "", "secretId": "" }, { "name": "", "secretId": "" }]` |
| `"calendars": "工作"` | `[]` |

---
### Requirement: Settings tab

The plugin SHALL register a settings tab. Its text SHALL be plain English that a fifth-grade student can read: short sentences, common words, no technical terms. The dashboard itself (year view, month view, and week popover) SHALL keep its Traditional Chinese text; the category names in the tab SHALL be the same Chinese category labels the dashboard shows, and the classification rule texts are user data that SHALL be shown as stored. The tab SHALL contain four sections in this order.

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

`Calendars`:

- The description `Show events from your calendars at the top of the month view. The plugin reads your calendars over the internet. It never changes them. Each calendar's link is kept in a safe place inside Obsidian, not in this plugin's files.`
- The hint `In Google Calendar, open the settings of a calendar and copy "Secret address in iCal format".`
- One row per stored calendar, in the stored order, including rows whose name or secret is empty. Each row has a text field (placeholder `Calendar name`) holding `name`, Obsidian's secret picker holding `secretId`, and a button labelled `Delete` that removes that calendar from the stored list.
- A button `Add a calendar` that appends `{ "name": "", "secretId": "" }`.

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

#### Scenario: Adding a calendar keeps the link out of plugin data

- **WHEN** the user presses `Add a calendar`, types `工作` as its name, and picks a secret whose ID is `work-calendar` in the secret picker
- **THEN** after the change is saved the plugin data MUST hold `"calendars": [{ "name": "工作", "secretId": "work-calendar" }]`
- **AND** the plugin data MUST NOT hold the calendar's address
