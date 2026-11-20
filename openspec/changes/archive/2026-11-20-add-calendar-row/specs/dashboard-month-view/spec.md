## MODIFIED Requirements

### Requirement: Month view layout

The month view SHALL show the same project rows as the year view, in the same order and grouping, with the same category legend, sort controls, `顯示已結案` filter, `編輯分類` controls, project name links, and resizable project column. Its columns SHALL be: the project column; one column per week of the shown month, headed by the week number without a leading zero and its Monday–Sunday range (for example `W44` and `10/26–11/1`, or `W1` and `1/4–1/10`); and a last column headed `還沒排`. When today's week is one of the shown weeks, its column SHALL be highlighted as in the year view; otherwise no column SHALL be highlighted. The month view's week headers and cells SHALL use their own classes (`th.month-week`, `td.month-cell`), so the year view's fixed 32px week width does not apply to them. The week columns SHALL share the remaining width equally, so the month view needs no horizontal scrolling. A cell SHALL grow in height to fit its task lines; long task text SHALL wrap. When `dashboard-calendar-row` requires a General row (at least one calendar with a non-empty secret ID), the first body row SHALL be that General row, above the project rows; its cells grow and wrap the same way.

#### Scenario: Month columns

- **WHEN** the month view shows `2026-11`
- **THEN** the columns MUST be the project column, `W45 11/2–11/8`, `W46 11/9–11/15`, `W47 11/16–11/22`, `W48 11/23–11/29`, `W49 11/30–12/6`, and `還沒排`

---
### Requirement: Month cells list the week's task lines

Each week cell of a project row in the month view SHALL list the project's task lines for that week, using the same task lines, the same week mapping (including the `Saturday tasks count for next week` setting), and the same order as the week popover. Each listed line SHALL show its task text, styled by its state:

- a done line SHALL show `✓` before the text, and the text SHALL be greyed;
- an open line whose week ends before today's week starts (an overdue line) SHALL show its text in the warning red;
- any other open line SHALL show its text normally.

Each project cell's kind SHALL be the kind the per-week cell model gives that week when the model runs over one continuous run of weeks that covers both the project's whole range (from its start through its overflow end) and the shown month, for any month and any year the month view can show (it does not depend on which year the year view renders). A week therefore has the same kind in the month view as in a year view that shows it, even when the shown month lies entirely after the project's expected end date. The kinds are `solid`, `settled`, `overflow`, `dashed`, and `blank`; a run that the per-week model returns as one `span-dashed` bar SHALL appear as individual `dashed` cells. The cell's background and border SHALL follow its kind. The week cells of the General row are defined by `dashboard-calendar-row`; they list events, have no cell kind, and never open a popover. A project cell SHALL show no text when no task line maps to its week, and a `blank` cell SHALL show no text even when task lines map to its week, because it cannot be opened (for example a task dated before the project's start).

#### Scenario: A blank week shows no text

- **GIVEN** a project that starts on `2026-11-02` and whose note contains `- [ ] 前置作業 📅 2026-10-28`
- **WHEN** the month view shows `2026-10`
- **THEN** that project's `W44` cell MUST be `blank` and MUST show no text

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

