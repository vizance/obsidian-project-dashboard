## MODIFIED Requirements

### Requirement: Settled week rendering

A week that is `occupied` and within the project's `[start, end]` range but whose every contributing task is complete (a `settled` week) SHALL be rendered distinctly from a week that still has an outstanding task. The dashboard SHALL render a settled week using the project's category color at reduced opacity, overlaid with a checkmark (`✅`) glyph drawn to fit the week cell. A settled week MUST NOT be rendered as a dashed or blank cell — the filled cell preserves the record that the week had scheduled tasks.

Task completion SHALL be judged at the **task level**, not per date marker: a task is complete when its source line's checkbox is `[x]` OR the line contains a `✅` date marker (`✅` followed by whitespace and an ISO `YYYY-MM-DD` date). A `✅` that is not followed by a date, such as one inside a link to a finished note (`[[✅ P-2026 範例：已完成專案]]`), SHALL NOT make a task complete. All dates contributed by a complete task inherit that completion. A week is settled iff it is in `occupied_weeks` AND no incomplete task contributes a date to it (equivalently, it is not in the set of weeks derived from incomplete tasks' dates).

Completion status SHALL be conveyed by the checkmark glyph (and opacity), never by a distinct hue. The category color and the overflow warning color remain the only hue-carrying semantics; future categories therefore never need to reserve a color for completion.

#### Scenario: All-done week renders as settled

- **GIVEN** an active project whose week `2026-W24` contains only completed tasks (each line is `[x]` or carries a `✅` date marker)
- **WHEN** the frontend renders this project
- **THEN** the `2026-W24` cell MUST be filled with the project's category color at reduced opacity
- **AND** a checkmark glyph MUST be overlaid on the cell
- **AND** the cell MUST NOT be dashed or blank

#### Scenario: Week with an outstanding task stays solid

- **GIVEN** a project whose week `2026-W23` contains a task line `- [ ] 和客戶確認合約修改 📅 2026-06-02` that is not checked and has no `✅`
- **WHEN** the frontend renders this project
- **THEN** the `2026-W23` cell MUST be the fully saturated category-color solid fill with no checkmark

#### Scenario: Mixed week counts as outstanding

- **GIVEN** a week containing one completed task and one incomplete task
- **WHEN** the frontend renders this project
- **THEN** the week MUST render as fully saturated solid (outstanding), NOT as settled

#### Scenario: Task with both 📅 and ✅ is treated as complete

- **GIVEN** a task line `- [x] 確認合約 📅 2026-05-01 ✅ 2026-04-26`
- **WHEN** the scanner derives completion
- **THEN** both the `2026-05-01` and `2026-04-26` weeks MUST treat this task as complete (the presence of a `📅` date MUST NOT make it outstanding)

#### Scenario: Overflow takes priority over settled

- **GIVEN** a week that is both in the overflow range (`end` < week ≤ `overflow_end`) and contains only completed tasks
- **WHEN** the frontend renders this project
- **THEN** the cell MUST render as the overflow warning color, NOT as the settled (dimmed + checkmark) style

#### Scenario: A link to a finished note does not complete a task

- **GIVEN** a project whose week `2026-W23` contains the task line `- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]] 📅 2026-06-02`
- **WHEN** the scanner derives completion
- **THEN** the task MUST be incomplete and the `2026-W23` cell MUST render as outstanding, not settled
