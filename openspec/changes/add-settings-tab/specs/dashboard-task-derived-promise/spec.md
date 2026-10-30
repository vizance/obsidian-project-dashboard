## MODIFIED Requirements

### Requirement: Output occupied_weeks per project

The scanner SHALL output a new `occupied_weeks` field of each project record. The value SHALL be a deduplicated, ascending-sorted list of ISO week labels in `YYYY-Www` format (where `ww` is zero-padded `01`–`53`), computed from the project's task dates as follows:

- For each task date `d` in the project's `task_dates` set:
  - If `d.weekday()` is Saturday and the `Saturday tasks count for next week` setting (`saturdayCountsAsNextWeek`) is on → add the ISO week label of `d + 2 days` (i.e., the Monday of the following ISO week; `d + 1 day` would still fall in the same ISO week because ISO weeks end on Sunday).
  - Otherwise → add the ISO week label of `d` (year and week number per ISO 8601).

Friday dates SHALL always occupy their own ISO week, identical to Monday–Thursday and Sunday. There is NO weekday that is excluded from occupation; Saturday is the only weekday whose contribution can be shifted, and only when the setting is on. The setting is off by default.

When the project has no task dates, `occupied_weeks` SHALL be `[]`.

#### Scenario: Mon-Thu task occupies current week

- **GIVEN** a project note containing `📅 2026-01-12` (Monday)
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W03"`

#### Scenario: Saturday task bumps to next week when the setting is on

- **GIVEN** a project note containing `📅 2026-02-21` (Saturday, ISO W8) and `Saturday tasks count for next week` is on
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W09"` and MUST NOT contain `"2026-W08"`

#### Scenario: Saturday task stays in its week when the setting is off

- **GIVEN** a project note containing `📅 2026-02-21` (Saturday, ISO W8) and `Saturday tasks count for next week` is off
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W08"` and MUST NOT contain `"2026-W09"`

#### Scenario: Friday task occupies its own week

- **GIVEN** a project note containing `📅 2026-06-19` (Friday, ISO W25)
- **WHEN** the scanner processes the file with the setting on or off
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W25"`
- **AND** the week label MUST NOT be shifted to any other week

#### Scenario: Sunday task occupies current week

- **GIVEN** a project note containing `📅 2026-01-11` (Sunday, ISO W2)
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain `"2026-W02"`

#### Scenario: Multiple tasks in same week deduplicated

- **GIVEN** a project note containing both `📅 2026-01-12` (Mon) and `📅 2026-01-14` (Wed), both in ISO W3
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST contain exactly one `"2026-W03"` entry (no duplicates)

#### Scenario: No task dates yields empty list

- **GIVEN** a project note with zero `📅` or `✅` task date occurrences
- **WHEN** the scanner processes the file
- **THEN** the project's `occupied_weeks` MUST equal `[]`

##### Example: Comprehensive multi-date project

- **GIVEN** a project note containing `📅 2026-01-12` (Mon), `📅 2026-02-21` (Sat), `📅 2026-03-13` (Fri), `📅 2026-05-15` (Fri)
- **WHEN** the scanner processes the file
- **THEN** `occupied_weeks` MUST equal `["2026-W03", "2026-W09", "2026-W11", "2026-W20"]` with the Saturday setting on, and `["2026-W03", "2026-W08", "2026-W11", "2026-W20"]` with it off
- **AND** `promised_end` MUST equal `"2026-05-15"` either way

##### Example: week of a single date

| Date | Setting off | Setting on |
| ---- | ----------- | ---------- |
| `2026-10-30` (Fri) | `2026-W44` | `2026-W44` |
| `2026-10-31` (Sat) | `2026-W44` | `2026-W45` |
| `2026-11-01` (Sun) | `2026-W44` | `2026-W44` |
| `2027-01-02` (Sat) | `2026-W53` | `2027-W01` |

---
### Requirement: Existing date fields preserved under per-week model

Introducing `occupied_weeks` and `task_dates` SHALL NOT change the value, type, or computation of `start`, `end`, `promised_end`, `overflow_end`, or `status`. In particular, `promised_end` SHALL continue to equal `max(task_dates)` regardless of weekday and regardless of the `Saturday tasks count for next week` setting. A Friday task date SHALL count toward `promised_end` and SHALL occupy its own ISO week. A Saturday task date SHALL count toward `promised_end` with its raw date, even when the week it occupies is shifted to the following ISO week.

#### Scenario: Friday task contributes to promised_end and occupies its own week

- **GIVEN** a project whose only task date is `📅 2026-05-15` (Friday, ISO W20)
- **WHEN** the scanner processes the file
- **THEN** `promised_end` MUST equal `"2026-05-15"`
- **AND** `occupied_weeks` MUST equal `["2026-W20"]`

#### Scenario: Saturday task contributes raw date to promised_end (no bump)

- **GIVEN** a project whose latest task date is `📅 2026-02-21` (Saturday) and `Saturday tasks count for next week` is on
- **WHEN** the scanner processes the file
- **THEN** `promised_end` MUST equal `"2026-02-21"` (the raw date, NOT the bumped following-week date)
- **AND** `occupied_weeks` MUST contain `"2026-W09"` (the bumped week)
