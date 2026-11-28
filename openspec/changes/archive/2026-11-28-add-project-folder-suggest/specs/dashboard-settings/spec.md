## MODIFIED Requirements

### Requirement: Settings tab

The plugin SHALL register a settings tab. Its text SHALL be plain English that a fifth-grade student can read: short sentences, common words, no technical terms. The dashboard itself (year view, month view, and week popover) SHALL keep its Traditional Chinese text; the category names in the tab SHALL be the same Chinese category labels the dashboard shows, and the classification rule texts are user data that SHALL be shown as stored. The tab SHALL contain four sections in this order.

`Project notes`:

- `Project folder`: a text field holding `projectFolder`, described as `The folder where your project notes live. Only notes right inside this folder are used. Notes in folders inside it are skipped. Tap or click the box to pick a folder from a list.`. When no folder with that path exists in the vault, the text `Can't find this folder.` SHALL be shown under the field. The field SHALL have a folder list, built on Obsidian's own input suggestion, that works the same on computers, tablets, and phones:
  - When the field gets focus, the list SHALL open under it and show the path of every folder in the vault, whatever the field holds.
  - After the user types or deletes text in the field, the list SHALL show only the folder paths that contain the field's text, with spaces at both ends removed, anywhere in the path, without regard to case. When that text is empty, the list SHALL show every folder. When the field loses focus, the next focus SHALL show every folder again.
  - The list SHALL never show the vault root (`/`), and SHALL be sorted by path in alphabetical order without regard to case.
  - Picking a folder from the list SHALL put its path into the field, close the list, and change `projectFolder` exactly as typing that path does: the same delayed save, the same re-scan of open dashboards, and the same `Can't find this folder.` hint.
  - Text that matches no folder SHALL still be accepted as typed.
- `Projects to skip`: a multi-line text field holding `excludedProjects`, one entry per line, described as `Write one word or phrase on each line. A note whose name has any of them will not show on the dashboard.`.

`Categories`:

- The description `If a project's name has the words on the left, it goes into the category on the right. The rules are checked from top to bottom, and the first one that matches wins. A category you pick by hand on the dashboard always beats these rules.`
- One row per stored classification rule, in the stored order, including rules whose text is empty, so that the rows and the stored list always correspond one to one. Each row has a text field (placeholder `Words in the name…`), a category dropdown listing the seven category labels, and three buttons labelled `Move up`, `Move down`, and `Delete`, which move or remove that rule in the stored list. `Move up` SHALL be disabled on the first row and `Move down` on the last row.
- A button `Add a rule` that appends a rule with empty text and category `other`. Such a rule SHALL survive saving and reloading and SHALL NOT take part in classification until its text is filled in.

`Dates`:

- `Which day to write`: a dropdown of `Monday` to `Sunday` holding `scheduleWeekday`, described as `When you add a task to a week from the week pop-up, the note gets this day of that week as the task's date.`. Choosing an option SHALL store the integer 1 (`Monday`) to 7 (`Sunday`), never the option's text or a numeric string.
- `Saturday tasks count for next week`: a toggle holding `saturdayCountsAsNextWeek`, described as `Turn this on if you plan next week on Saturday. Then a task with a Saturday date shows up in the week after.`.

`Calendars`:

- The description `Show events from your calendars at the top of the month view. The plugin only reads your calendars. It never changes them.`
- The hint `Google Calendar: open the calendar's settings and copy "Secret address in iCal format" (iCal 格式的私密網址).`
- The hint `iCloud: share the calendar as a public calendar and copy its link.`
- One row per stored calendar, in the stored order, including rows whose name or link is empty. Each row has a text field (placeholder `Calendar name`) holding `name`, which accepts any text including Chinese; a link field; a color picker (tooltip `Color`) holding `color`, which shows the calendar's default color while `color` is empty and stores the picked color as `#rrggbb`; and a button labelled `Delete`.
- The link field SHALL never show a stored address. Its placeholder SHALL be `Paste the calendar link here` when the calendar has no secret ID, `Link saved. Paste a new link to change it.` when its secret ID holds a non-empty value on this device, and `This computer has no link yet. Paste it here.` when its secret ID holds no value on this device.
- The link field SHALL take its text when the user pastes into it, presses Enter, or leaves it. When the trimmed text starts with `https://` or `webcal://`, the plugin SHALL store it in Obsidian's secret storage under the calendar's secret ID — the existing one when it starts with `project-dashboard-calendar-`, or otherwise (no ID, or an ID the plugin did not create) a new ID `project-dashboard-calendar-` followed by 8 random lowercase letters and digits that no other calendar in the list uses — save that ID in `secretId` through the normal delayed save, clear the field, and show the saved placeholder. Any other non-empty text SHALL NOT be stored; the text `This is not a calendar link. It should start with https:// or webcal://.` SHALL be shown under the row until the field's text changes. Empty text SHALL change nothing.
- `Delete` SHALL remove that calendar from the stored list; when its secret ID starts with `project-dashboard-calendar-`, the plugin SHALL also overwrite that stored value with an empty string, so no link the plugin saved is left behind.
- A button `Add a calendar` that appends `{ "name": "", "secretId": "", "color": "" }`.
- The `Calendars` section SHALL NOT show the words `secret` or `ID`, except inside Google's own label quoted in the hint.

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

- **WHEN** the user presses `Add a calendar`, types `家人行事曆` as its name, and pastes `https://calendar.example.com/private-abc/basic.ics` into its link field
- **THEN** after the change is saved the plugin data MUST hold one calendar named `家人行事曆` whose `secretId` matches `project-dashboard-calendar-[a-z0-9]{8}`
- **AND** Obsidian's secret storage MUST hold `https://calendar.example.com/private-abc/basic.ics` under that ID
- **AND** the plugin data MUST NOT hold the calendar's address
- **AND** the link field MUST be empty with the placeholder `Link saved. Paste a new link to change it.`

#### Scenario: A wrong link is not saved

- **WHEN** the user pastes `calendar.example.com/feed.ics` into an empty calendar row's link field
- **THEN** nothing MUST be stored in Obsidian's secret storage and the calendar's `secretId` MUST stay `""`
- **AND** the row MUST show `This is not a calendar link. It should start with https:// or webcal://.`

#### Scenario: Deleting a calendar removes its saved link

- **GIVEN** a calendar whose link was pasted in the settings tab and saved under the ID `project-dashboard-calendar-a1b2c3d4`
- **WHEN** the user presses that row's `Delete`
- **THEN** the calendar MUST be removed from `calendars`
- **AND** the value stored under `project-dashboard-calendar-a1b2c3d4` MUST be an empty string

#### Scenario: Clicking the folder field lists every folder

- **GIVEN** the vault has the folders `Work/Projects`, `Archive`, `Projects`, and `Work`, and `Project folder` holds `Projects`
- **WHEN** the user taps or clicks the `Project folder` field
- **THEN** the folder list MUST show `Archive`, `Projects`, `Work`, and `Work/Projects`, in this order
- **AND** it MUST NOT show `/`

#### Scenario: Typing narrows the folder list

- **GIVEN** the vault has the folders `Archive`, `Projects`, `Work`, and `Work/Projects`
- **WHEN** the user clears `Project folder` and types `proj`
- **THEN** the folder list MUST show only `Projects` and `Work/Projects`, in this order

#### Scenario: Picking a folder saves it

- **GIVEN** a dashboard tab is open and the vault has a folder `Work/Projects` with project notes
- **WHEN** the user opens the folder list of `Project folder` and picks `Work/Projects`
- **THEN** the field MUST hold `Work/Projects` and the folder list MUST close
- **AND** after the change is saved the plugin data MUST hold `"projectFolder": "Work/Projects"`
- **AND** `Can't find this folder.` MUST NOT be shown
- **AND** within 1 second the dashboard MUST show the projects from `Work/Projects`
