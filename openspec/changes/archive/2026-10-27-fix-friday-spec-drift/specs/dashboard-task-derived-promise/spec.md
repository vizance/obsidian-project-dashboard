## MODIFIED Requirements

### Requirement: Existing date fields preserved under per-week model

Introducing `occupied_weeks` and `task_dates` SHALL NOT change the value, type, or computation of `start`, `end`, `promised_end`, `overflow_end`, or `status`. In particular, `promised_end` SHALL continue to equal `max(task_dates)` regardless of weekday. A Friday task date SHALL count toward `promised_end` and SHALL occupy its own ISO week, like every weekday except Saturday. A Saturday task date SHALL count toward `promised_end` with its raw date, even though the week it occupies is shifted to the following ISO week.

#### Scenario: Friday task contributes to promised_end and occupies its own week

- **GIVEN** a project whose only task date is `📅 2026-05-15` (Friday, ISO W20)
- **WHEN** the scanner processes the file
- **THEN** `promised_end` MUST equal `"2026-05-15"`
- **AND** `occupied_weeks` MUST equal `["2026-W20"]`

#### Scenario: Saturday task contributes raw date to promised_end (no bump)

- **GIVEN** a project whose latest task date is `📅 2026-02-21` (Saturday)
- **WHEN** the scanner processes the file
- **THEN** `promised_end` MUST equal `"2026-02-21"` (the raw date, NOT the bumped following-week date)
- **AND** `occupied_weeks` MUST contain `"2026-W09"` (the bumped week)
