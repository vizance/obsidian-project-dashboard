## MODIFIED Requirements

### Requirement: Month cells list the week's task lines

Each week cell of a project row in the month view SHALL list the project's task lines for that week, using the same task lines, the same week mapping (including the `Saturday tasks count for next week` setting), and the same order as the week popover. Each listed line SHALL show its task text, styled by its state:

- a done line SHALL show `✓` before the text, and the text SHALL be greyed;
- an open line whose week ends before today's week starts (an overdue line) SHALL show its text in the warning red;
- any other open line SHALL show its text normally.

Each project cell's kind SHALL be the kind the per-week cell model (`dashboard-gantt-rendering`) gives that week. That kind depends only on the week and the project, so a week has the same kind in the month view as in any year view that shows it, for any month and any year. The kinds are `solid`, `settled`, `overflow`, `dashed`, and `blank`; a run that the per-week model returns as one `span-dashed` bar SHALL appear as individual `dashed` cells. The cell's background and border SHALL follow its kind. The week cells of the General row are defined by `dashboard-calendar-row`; they list events, have no cell kind, and never open a popover. A project cell SHALL show no text when no task line maps to its week. A week with task lines is never `blank`, so every task line with a date is listed in its week, including tasks dated before the project's start or after its expected end.

#### Scenario: A task before the start date is listed

- **GIVEN** a project that starts on `2026-11-02` and whose note contains `- [ ] 前置作業 📅 2026-10-28`
- **WHEN** the month view shows `2026-10`
- **THEN** that project's `W44` cell MUST be `solid` and MUST list `前置作業`

#### Scenario: A Saturday task after the expected end is listed

- **GIVEN** an open project with expected end `2026-11-06`, `Saturday tasks count for next week` turned on, and a note containing `- [ ] 追蹤款項 📅 2026-12-05`
- **WHEN** the month view shows `2026-12`
- **THEN** that project's `W50` cell MUST be `overflow` and MUST list `追蹤款項`

#### Scenario: Overflow weeks after the expected end

- **GIVEN** an open project that runs from `2026-08-03` to `2026-08-30` and whose note contains `- [ ] 補交成果報告 📅 2026-09-09`
- **WHEN** the month view shows `2026-09`
- **THEN** that project's `W37` cell MUST be `overflow` and MUST list `補交成果報告`

#### Scenario: Line states in one cell

- **GIVEN** today is `2026-10-30` and a project's note contains `- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26`, `- [ ] 確認拍攝服裝 📅 2026-10-30`, and `- [ ] 寄出合約 📅 2026-10-21`
- **WHEN** the month view shows `2026-10`
- **THEN** the `W44` cell MUST list `✓ 租借場地` greyed and `確認拍攝服裝` in normal text
- **AND** the `W43` cell MUST list `寄出合約` in the warning red

##### Example: line state

| Line | Mapped week | Today | State |
| ---- | ----------- | ----- | ----- |
| `- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26` | 2026-W44 | 2026-10-30 | done |
| `- [ ] 確認拍攝服裝 📅 2026-10-30` | 2026-W44 | 2026-10-30 | open |
| `- [ ] 寄出合約 📅 2026-10-21` | 2026-W43 | 2026-10-30 | overdue |
| `- [ ] 寄出合約 📅 2026-10-21` | 2026-W43 | 2026-10-25 | open |
| `會議紀錄 📅 2026-10-21` (no checkbox) | 2026-W43 | 2026-10-30 | overdue |

