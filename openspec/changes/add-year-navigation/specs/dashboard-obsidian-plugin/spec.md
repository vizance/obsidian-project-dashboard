## MODIFIED Requirements

### Requirement: Calendar year follows today's local date

The plugin SHALL derive today's date from the local date, formatted as `YYYY-MM-DD` in the user's local time zone; today's date SHALL NOT be derived from a UTC conversion. The year view SHALL open on the calendar year of today's date, and the user can show other years as defined by `dashboard-month-view` ("Switching between the year view and the month view"). The week columns SHALL cover every ISO week whose Thursday falls in the shown year. A project without any end date SHALL default to December 31 of today's year, whatever year is shown, with the warning `迄日預設為 <year>-12-31`.

In the year view of any year, a week's cell SHALL be what the per-week or timeline model gives that week when the project's whole range is considered, including the weeks after its expected end up to its overflow end. A project whose expected end lies in an earlier year SHALL therefore still show its overflow weeks in the shown year, and in the `timeline` view mode its bar SHALL start at the first week of the shown year and end at the week of its overflow end. For the year of today's date the cells SHALL stay as they are, apart from this rule.

#### Scenario: Taipei early morning uses the local date

- **GIVEN** the local time zone is Asia/Taipei and the local time is 2026-10-26 07:30 (UTC 2026-10-25 23:30)
- **WHEN** the dashboard renders
- **THEN** today MUST be `2026-10-26`
- **AND** the highlighted week column MUST be `W44`

##### Example: year-derived values

| Today (local) | Week columns | Default end |
| ------------- | ------------ | ----------- |
| `2026-10-25` | `W1` through `W53` | `2026-12-31` |
| `2027-01-05` | `W1` through `W52` | `2027-12-31` |
| `2026-11-20`, year view showing `2027 年` | `W1` through `W52` | `2026-12-31` |

#### Scenario: Overflow into the next year

- **GIVEN** an open project that runs from `2026-10-01` to `2026-12-20` and whose note contains `- [ ] 結案報告 📅 2027-01-13`
- **WHEN** the year view shows `2027 年`
- **THEN** in the `per-week` view mode its `W2` cell MUST be `overflow` and its `W1` cell MUST be `blank`
- **AND** in the `timeline` view mode its bar MUST span `W1` through `W2`
