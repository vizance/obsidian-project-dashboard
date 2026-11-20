# dashboard-robustness Specification

## Purpose

Keep the dashboard responsive and safe when notes, calendars, or settings contain broken or hostile content: bounded parsing, linear-time text handling, CommonMark-correct fences, secrets the plugin does not own left untouched, and no saves after the plugin unloads.

## Requirements

### Requirement: Malformed recurrence rules cannot freeze the dashboard

When the plugin expands a calendar event's recurrence, every search for the event's next occurrence SHALL stop after examining 200,000 candidate dates. When the limit is reached, the event SHALL be treated as having no further occurrences, and every other event and calendar SHALL be shown as usual. This limit is in addition to the 100,000-occurrence limit of `dashboard-calendar-row`.

#### Scenario: An impossible daily rule

- **GIVEN** a calendar contains an event with `RRULE:FREQ=DAILY;BYMONTH=2;BYMONTHDAY=30;UNTIL=20261231T000000Z` and another event `讀書會` on `2026-11-06` 13:30
- **WHEN** the month view shows `2026-11`
- **THEN** the expansion MUST finish within 1 second
- **AND** `11/6（五）13:30 讀書會` MUST be shown

---
### Requirement: The plugin only overwrites its own secrets

The settings tab SHALL store a pasted calendar link under the calendar's secret ID only when that ID starts with `project-dashboard-calendar-`. When the calendar uses any other ID, the plugin SHALL create a new ID `project-dashboard-calendar-` followed by 8 random lowercase letters and digits, store the link under it, and point the calendar to it, leaving the value under the old ID unchanged.

#### Scenario: A secret chosen with the old picker stays untouched

- **GIVEN** a calendar whose secret ID is `other-plugin-credential`, and that secret holds `keep-me`
- **WHEN** the user pastes `https://calendar.example.com/new.ics` into its link field
- **THEN** the secret `other-plugin-credential` MUST still hold `keep-me`
- **AND** the calendar's secret ID MUST now match `project-dashboard-calendar-[a-z0-9]{8}` and that secret MUST hold the new link

---
### Requirement: Untrusted text is processed in linear time

Removing a task's completion marker when a task is unticked SHALL take time proportional to the length of the line. A line made of `- [x] Task `, 40,000 spaces, and `x 📅 2026-11-06` SHALL be processed in under 50 ms.

#### Scenario: A long run of spaces

- **WHEN** the line `- [x] Task ` followed by 40,000 spaces and `x 📅 2026-11-06` is unticked
- **THEN** the new line MUST be produced in under 50 ms
- **AND** it MUST equal the old line with `[x]` replaced by `[ ]`

---
### Requirement: Fenced code blocks follow CommonMark

A fenced code block SHALL open with a line of at least three backticks or at least three tildes, and SHALL close only at a line made of the same character repeated at least as many times as the opening, followed only by spaces or tabs. Checkbox lines inside a fenced code block SHALL NOT be task lines and SHALL never be written.

#### Scenario: A three-backtick example inside a four-backtick block

- **GIVEN** a note whose lines are ` ````md `, ` ``` `, `- [ ] 範例任務`, ` ``` `, ` ```` `, `- [ ] 真的任務`
- **WHEN** the note is scanned
- **THEN** `範例任務` MUST NOT be a task line
- **AND** `真的任務` MUST be a task line

---
### Requirement: Calendar data is released and bounded

Time zone definitions registered while reading a calendar SHALL be copies that do not refer back to the calendar's events. When the plugin unloads, it SHALL remove the time zones it registered. A calendar response larger than 20 MB SHALL NOT be parsed and SHALL count as a failed calendar with the reason `行事曆太大`.

#### Scenario: Nothing stays after unload

- **GIVEN** five calendars, each defining its own time zone and an event with a 1,000,000-character description, were read
- **WHEN** the plugin unloads
- **THEN** no time zone registered by the plugin MUST remain, and no event description MUST be reachable from the time zone registry

---
### Requirement: The link field hides and clears rejected links

The calendar link field in the settings tab SHALL be a password-style field with spell checking and autocomplete turned off. When the text it receives is rejected as not a calendar link, the field SHALL be cleared and the message `This is not a calendar link. It should start with https:// or webcal://.` SHALL be shown.

#### Scenario: A rejected link does not stay on screen

- **WHEN** the user pastes `HTTPS://calendar.example.com/private-demo/basic.ics` into an empty link field
- **THEN** the field MUST be empty and the message MUST be shown
- **AND** nothing MUST be stored in Obsidian's secret storage

---
### Requirement: Nothing is saved after the plugin unloads

When the plugin unloads, a settings change still waiting for its delayed save SHALL be saved at once, and no later change SHALL be saved.

#### Scenario: Unloading during the save delay

- **GIVEN** the user changed a setting 100 ms ago
- **WHEN** the plugin unloads
- **THEN** the change MUST be saved once right away
- **AND** no save MUST happen after that
