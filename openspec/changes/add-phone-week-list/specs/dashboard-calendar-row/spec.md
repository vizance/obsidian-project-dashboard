## MODIFIED Requirements

### Requirement: When calendars are fetched

The plugin SHALL fetch every calendar whose secret ID is not empty at exactly these moments: when a dashboard tab opens; when the user presses the General row's `↻` button; when the user runs the command `Refresh calendars` (id `refresh-calendars`; the command palette shows `Project Dashboard: Refresh calendars`); when the settings tab stores a new link for a calendar whose secret ID does not change; and whenever the list of calendars to fetch — the non-empty secret IDs in settings order — becomes different from the one used by the last fetch: after a save of plugin data, after a reload of plugin data changed outside the running plugin, or after a failed save restores the last saved settings. Renaming a calendar or changing its color SHALL NOT start a fetch. Nothing else SHALL start a fetch: no timer, no change of the shown month, no switch between the year view and the month view, and no note change. When no calendar has a non-empty secret ID, no network request SHALL be made.

On a phone — where the dashboard shows the phone week list (see dashboard-phone-week-list) — none of the moments above SHALL start a fetch, the command `Refresh calendars` SHALL NOT be registered, and the plugin SHALL make no network request, whatever `calendars` holds.

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
- **THEN** the General row MUST show only the events last fetched from `家庭`, each with the label `家庭`
- **AND** no event from `工作` MUST be shown

#### Scenario: Repeated presses make one extra fetch

- **GIVEN** a fetch is running
- **WHEN** the user presses `↻` three times before it finishes
- **THEN** exactly one more fetch MUST run after it


#### Scenario: A phone never fetches

- **GIVEN** a calendar `工作` has a non-empty secret ID in plugin data
- **WHEN** the user opens the dashboard on a phone, changes a setting, and opens the command palette
- **THEN** no network request MUST be made
- **AND** the command palette MUST NOT list `Project Dashboard: Refresh calendars`
