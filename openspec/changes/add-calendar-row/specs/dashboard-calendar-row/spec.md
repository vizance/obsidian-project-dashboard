## ADDED Requirements

### Requirement: Calendar links are kept in Obsidian's secret storage

Each configured calendar SHALL be stored in plugin data only as a name and a secret ID (see `dashboard-settings`). The calendar's address SHALL be read from Obsidian's secret storage with that secret ID each time the calendar is fetched, and SHALL NOT be written to plugin data, local storage, the console, a notice, a tooltip, or any text the dashboard shows. Every message about a calendar SHALL name it by its display name: its stored name, or `行事曆 <n>` when the stored name is empty, where `<n>` is its 1-based position in the settings list.

An address starting with `https://` SHALL be fetched as it is. An address starting with `webcal://` SHALL be fetched with `webcal://` replaced by `https://` and the rest unchanged. Leading and trailing whitespace SHALL be ignored. Any other address SHALL NOT be fetched and SHALL count as a failed calendar with the reason `連結格式不對`. A calendar whose secret ID is empty SHALL be skipped without a request and without a message, because it is a row the user has not finished. A calendar whose secret ID has no stored value on this device SHALL count as a failed calendar with the reason `這台裝置找不到連結`.

#### Scenario: The address never reaches plugin data

- **GIVEN** the user adds a calendar named `工作` whose secret holds `https://calendar.example.com/private-abc/basic.ics`
- **WHEN** the change is saved and the calendar is fetched
- **THEN** the plugin data file MUST NOT contain `calendar.example.com`
- **AND** no notice, tooltip, or dashboard text MUST contain `calendar.example.com`

##### Example: address handling

| Stored secret | Result |
| ------------- | ------ |
| `https://calendar.example.com/feed.ics` | fetch `https://calendar.example.com/feed.ics` |
| `webcal://calendar.example.com/feed.ics` | fetch `https://calendar.example.com/feed.ics` |
| `  https://calendar.example.com/feed.ics  ` | fetch `https://calendar.example.com/feed.ics` |
| `http://calendar.example.com/feed.ics` | failed, `連結格式不對` |
| `calendar.example.com/feed.ics` | failed, `連結格式不對` |
| no value stored for the secret ID | failed, `這台裝置找不到連結` |

---
### Requirement: When calendars are fetched

The plugin SHALL fetch every calendar whose secret ID is not empty at exactly these moments: when a dashboard tab opens; when the user presses the General row's `↻` button; when the user runs the command `Refresh calendars` (id `refresh-calendars`; the command palette shows `Project Dashboard: Refresh calendars`); and whenever the `calendars` setting held in memory becomes different from the one used by the last fetch: after a save of plugin data, after a reload of plugin data changed outside the running plugin, or after a failed save restores the last saved settings. Nothing else SHALL start a fetch: no timer, no change of the shown month, no switch between the year view and the month view, and no note change. When no calendar has a non-empty secret ID, no network request SHALL be made.

All open dashboard tabs SHALL share one fetch and one set of results. A fetch requested while another is running SHALL NOT start a second concurrent fetch; instead exactly one more fetch SHALL run after the running one finishes, using the settings at that moment. Each calendar SHALL be requested with Obsidian's request function using `GET` and no body. A response whose status is outside 200–299 SHALL count as a failed calendar with the reason `讀取失敗（HTTP <status>）`; a request that throws SHALL count as failed with `連不上`; a response whose text is not a valid iCalendar object SHALL count as failed with `內容看不懂`. When a calendar fails, the events it returned in the last successful fetch during this plugin session SHALL stay shown; a calendar that has never succeeded in this session shows no events. Retained events SHALL be identified by the calendar's secret ID, never by its position in the list: a calendar that is removed from `calendars`, or whose secret ID changes, SHALL lose its retained events at the next fetch, and the remaining calendars SHALL keep their own events and display names. Fetched events SHALL be kept in memory only and SHALL be discarded when the plugin unloads; a response that arrives after the plugin has unloaded, and any follow-up fetch queued before it, SHALL be dropped without notifying any dashboard.

#### Scenario: No calendar, no network

- **GIVEN** `calendars` is `[]`
- **WHEN** the user opens the dashboard and switches to the month view
- **THEN** no network request MUST be made
- **AND** the month view MUST NOT show a General row

#### Scenario: Changing the month does not fetch

- **GIVEN** a calendar is set and its fetch has finished
- **WHEN** the user presses `▶` twice and `本月`
- **THEN** no new request MUST be made

#### Scenario: A failure keeps the earlier events

- **GIVEN** the calendar `工作` was fetched successfully and its event `11/6（五）13:30 讀書會` is shown
- **WHEN** the user presses `↻` and the request for `工作` returns status 404
- **THEN** `11/6（五）13:30 讀書會` MUST still be shown
- **AND** the General row MUST report `工作：讀取失敗（HTTP 404）`

#### Scenario: Removing a calendar keeps the others' events

- **GIVEN** two calendars, `工作` (secret ID `work-calendar`) and `家庭` (secret ID `family-calendar`), were both fetched successfully
- **WHEN** the user deletes `工作` in the settings tab, the change is saved, and the following fetch of `家庭` fails
- **THEN** the General row MUST show only the events last fetched from `家庭`, with the tooltip `家庭`
- **AND** no event from `工作` MUST be shown

#### Scenario: Repeated presses make one extra fetch

- **GIVEN** a fetch is running
- **WHEN** the user presses `↻` three times before it finishes
- **THEN** exactly one more fetch MUST run after it

---
### Requirement: Events are expanded and assigned to weeks

From each fetched calendar the plugin SHALL read every event (`VEVENT`) and SHALL ignore events whose status is `CANCELLED`. Date-times with a time zone (`TZID`, using the time zone definitions in the calendar) or in UTC SHALL be converted to the device's local time; date-times without a time zone, and date-times whose `TZID` has no definition in the same calendar, SHALL be read as local time; all-day dates (`VALUE=DATE`) SHALL be used as written. An event's end is its `DTEND`, which is exclusive; without `DTEND` it is `DTSTART` plus `DURATION`; without either, a timed event ends at its start and an all-day event lasts one day.

Recurring events (`RRULE`, `RDATE`) SHALL be expanded into occurrences. Dates in `EXDATE` SHALL be removed. An event with a `RECURRENCE-ID` SHALL replace the occurrence it names; when that replacement has status `CANCELLED`, the occurrence SHALL be removed. A replaced occurrence SHALL be placed by its replacement's start and end, wherever its original date was, so an override moved into or out of the shown weeks appears or disappears accordingly. Expansion SHALL only produce occurrences whose final start and end overlap the weeks being shown, and SHALL stop examining one event after 100,000 occurrences counted from its first one, so a malformed rule cannot freeze the dashboard while a daily event that started decades ago still reaches the shown month.

An occurrence SHALL belong to every ISO week whose half-open range [Monday 00:00, next Monday 00:00), in local time, overlaps the occurrence's half-open range [start, end); an occurrence that ends at its start SHALL belong to the week containing its start. An occurrence that ends exactly at a Monday 00:00 therefore does not belong to the week that starts then. The Saturday setting for tasks SHALL NOT apply to events: an event on a Saturday belongs to the week of that Saturday. Two occurrences with the same `UID` and the same start, from the same or different calendars, SHALL be shown once.

Within one week the occurrences SHALL be ordered by start date; on the same start date, all-day occurrences SHALL come before timed ones, timed ones SHALL be ordered by start time, and remaining ties SHALL be ordered by the calendar's position in the settings and then by title.

#### Scenario: A weekly event with an exception and an excluded date

- **GIVEN** the device's time zone is `Asia/Taipei` and a calendar contains a weekly event `語言課` every Wednesday at 19:00 starting `2026-11-04`, with `EXDATE` `2026-11-18 19:00` and an override for `RECURRENCE-ID` `2026-11-25 19:00` moving it to `2026-11-26 20:00`
- **WHEN** the month view shows `2026-11`
- **THEN** the General row MUST show `11/4（三）19:00 語言課` in `W45`, `11/11（三）19:00 語言課` in `W46`, nothing in `W47`, `11/26（四）20:00 語言課` in `W48`, and `12/2（三）19:00 語言課` in `W49`

##### Example: week assignment (device time zone `Asia/Taipei`)

| Event | Weeks |
| ----- | ----- |
| `DTSTART;TZID=Asia/Taipei:20261106T133000`, `DTEND;TZID=Asia/Taipei:20261106T150000`, `讀書會` | 2026-W45 |
| `DTSTART:20261106T053000Z`, `DTEND:20261106T070000Z`, `讀書會` | 2026-W45 |
| `DTSTART;VALUE=DATE:20261111`, `DTEND;VALUE=DATE:20261112`, `休假` | 2026-W46 |
| `DTSTART;VALUE=DATE:20261107`, `DTEND;VALUE=DATE:20261110`, `研習營` | 2026-W45, 2026-W46 |
| `DTSTART;TZID=Asia/Taipei:20261108T220000`, `DTEND;TZID=Asia/Taipei:20261109T010000`, `夜間維護` | 2026-W45, 2026-W46 |
| `DTSTART;TZID=Asia/Taipei:20261031T100000`, `DTEND;TZID=Asia/Taipei:20261031T110000`, `市集` (Saturday, Saturday setting on) | 2026-W44 |
| `DTSTART;TZID=Asia/Taipei:20261106T090000`, `STATUS:CANCELLED`, `晨會` | none |
| `DTSTART;VALUE=DATE:20261107`, `DTEND;VALUE=DATE:20261109`, `週末營` | 2026-W45 |
| `DTSTART;TZID=Asia/Taipei:20261108T220000`, `DTEND;TZID=Asia/Taipei:20261109T000000`, `夜讀` | 2026-W45 |
| `DTSTART;TZID=America/New_York:20261106T220000` with no `VTIMEZONE` for `America/New_York` in the calendar, `視訊會議` | 2026-W45, shown as `11/6（五）22:00 視訊會議` |
| weekly `語言課` every Wednesday 19:00 from `2026-10-07`, with an override for `RECURRENCE-ID` `2026-10-28 19:00` moving it to `2026-11-02 19:00` | the override in 2026-W45 (month `2026-11`), and nothing for it in 2026-W44 |

##### Example: order within a week (`2026-W45`)

| Occurrences in the calendar | Order shown |
| --------------------------- | ----------- |
| `讀書會` 11/6 13:30, `休假` all day 11/6, `語言課` 11/4 19:00 | `11/4（三）19:00 語言課`, `11/6（五）休假`, `11/6（五）13:30 讀書會` |

---
### Requirement: Event line text

Each occurrence SHALL be shown as one line of text built from local dates and 24-hour times with two-digit hours and minutes (`09:05`); dates SHALL be written as month/day without leading zeros followed by the weekday in full-width parentheses, as in `11/6（五）`, with no space between a date and the time that follows it:

- A timed occurrence that starts and ends on the same date, or ends at its start: `<start date><start time> <title>`.
- A timed occurrence that ends on a later date: `<start date><start time>–<end date><end time> <title>`.
- An all-day occurrence lasting one day: `<date><title>`.
- An all-day occurrence lasting more than one day: `<first day>–<last day><title>`, where the last day is the day before the exclusive end.

An occurrence without a title SHALL use the title `（沒有標題）`. Each line's tooltip SHALL be the display name of its calendar.

#### Scenario: Line text for each kind of occurrence

- **WHEN** the occurrences below are shown in the General row
- **THEN** each MUST be written as the line in the table below

##### Example: line text

| Occurrence (local time) | Line |
| ----------------------- | ---- |
| `讀書會`, 2026-11-06 13:30–15:00 | `11/6（五）13:30 讀書會` |
| `休假`, all day 2026-11-11 | `11/11（三）休假` |
| `研習營`, all day from 2026-11-07, exclusive end 2026-11-10 | `11/7（六）–11/9（一）研習營` |
| `夜間維護`, 2026-11-08 22:00 to 2026-11-09 01:00 | `11/8（日）22:00–11/9（一）01:00 夜間維護` |
| no title, 2026-11-06 09:05 | `11/6（五）09:05 （沒有標題）` |

---
### Requirement: General row in the month view

When at least one calendar has a non-empty secret ID, the month view SHALL show a General row as the first row of its body, above every project row and above the `（沒有符合條件的專案）` row. Its project-column cell SHALL show `General`, a status line, and a button `↻` with the tooltip `重新讀取行事曆`. Each of its week cells SHALL list the lines of the occurrences assigned to that week, in order, and SHALL be empty when there are none; the cell of today's week SHALL be highlighted like the other cells of that column. Its `還沒排` cell SHALL be empty. Clicking a General cell SHALL NOT open a popover; like any click outside a popover, it SHALL close an open one.

The status line SHALL read:

- nothing, before the first fetch of this plugin session has started;
- `讀取中…` while a fetch is running;
- otherwise, after the first fetch in this plugin session has finished, `更新於 <HH:MM>` with the local time at which the last fetch finished, followed by `・⚠ <n> 個行事曆讀不到` when `<n>` calendars failed in that fetch; the tooltip of the status line SHALL then list `<display name>：<reason>` for each failed calendar, one per line.

The year view SHALL NOT show any events.

#### Scenario: The General row lists a week's events

- **GIVEN** the device's time zone is `Asia/Taipei`, a calendar `工作` contains `讀書會` on `2026-11-06` from 13:30 to 15:00, and its fetch has finished at 15:20
- **WHEN** the month view shows `2026-11`
- **THEN** the first body row MUST be the General row
- **AND** its `W45` cell MUST list `11/6（五）13:30 讀書會` with the tooltip `工作`
- **AND** its status line MUST read `更新於 15:20`

#### Scenario: A failed calendar is reported by name

- **GIVEN** two calendars, `工作` that loads and an unnamed second calendar whose secret holds `http://calendar.example.com/feed.ics`
- **WHEN** a fetch finishes at 09:00
- **THEN** the status line MUST read `更新於 09:00・⚠ 1 個行事曆讀不到`
- **AND** its tooltip MUST be `行事曆 2：連結格式不對`

#### Scenario: The year view has no General row

- **GIVEN** a calendar is set and has events
- **WHEN** the year view is shown
- **THEN** no General row and no event text MUST be shown

---
### Requirement: Network use is limited and disclosed

The plugin SHALL make network requests only to the calendar addresses the user stored, only with `GET`, only at the moments listed in "When calendars are fetched", and SHALL NOT send any vault content, setting, or other data. The README SHALL state, in English and in Traditional Chinese, that the plugin uses the network only when calendars are set, which addresses it reads, that it never writes to a calendar, that fetched events stay in memory, and where the addresses are kept.

The plugin bundles ical.js, which is licensed under MPL-2.0. The comment at the top of `main.js` SHALL name ical.js, its license, and the address of its source code, and the README SHALL have a section on bundled third-party code with the same information.

#### Scenario: Bundle notice

- **WHEN** a release `main.js` is built
- **THEN** its opening comment MUST contain `ical.js`, `MPL-2.0`, and `https://github.com/kewisch/ical.js`
