## MODIFIED Requirements

### Requirement: Tooltip shows raw task dates for occupied weeks

When the user hovers over a week cell that is `occupied`, the tooltip SHALL include the project name AND the list of raw `task_dates` from `project.task_dates` that map to that week under the per-week rules. When the `週六的任務算到下一週` setting is on, each Saturday date that was bumped to the next week SHALL be annotated with a marker indicating it represents a next-week-execution intent. When the setting is off, no date SHALL carry that marker. Non-occupied cells (dashed or empty) SHALL keep their existing tooltip content.

#### Scenario: Tooltip lists Mon dates for current-week occupation

- **GIVEN** a project with `task_dates = ["2026-01-12", "2026-01-14"]` (both in W3)
- **WHEN** the user hovers over the W3 cell of this project
- **THEN** the tooltip MUST include `"2026-01-12"` and `"2026-01-14"`

#### Scenario: Tooltip annotates bumped Saturday dates

- **GIVEN** a project with `task_dates = ["2026-02-21"]` (Saturday, bumped to W9) and `週六的任務算到下一週` on
- **WHEN** the user hovers over the W9 cell of this project
- **THEN** the tooltip MUST include `"2026-02-21"` AND a marker indicating Saturday → next-week execution (e.g., the literal substring `Sat → 本週執行` or equivalent annotation)

#### Scenario: Saturday dates carry no marker when the setting is off

- **GIVEN** a project with `task_dates = ["2026-02-21"]` (Saturday, ISO W8) and `週六的任務算到下一週` off
- **WHEN** the user hovers over the W8 cell of this project
- **THEN** the tooltip MUST include `"2026-02-21"` without the Saturday marker
