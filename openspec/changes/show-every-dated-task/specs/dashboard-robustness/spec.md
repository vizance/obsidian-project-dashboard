## ADDED Requirements

### Requirement: One project's dates cannot break the dashboard

Drawing a project's cells SHALL take time proportional to the number of weeks shown, whatever the project's start and end dates are. When drawing one project's row fails, that row SHALL show the project's name, empty week cells, and the warning `⚠` with the tooltip `這個專案的日期有問題`, and every other row SHALL be drawn as usual.

#### Scenario: An expected end in the year 9999

- **GIVEN** a project note with `開始日期: 2026-01-01` and `預計結束日期: 9999-12-31`
- **WHEN** the year view of 2026 and the month view of `2026-11` render
- **THEN** each MUST finish drawing that project in under 50 ms
- **AND** every other project row MUST be drawn
