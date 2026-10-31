## ADDED Requirements

### Requirement: A week belongs to the month of its Monday

Every ISO week SHALL belong to the calendar month that contains its Monday, with one exception: ISO week 1 SHALL always belong to January of its ISO year, even when its Monday falls in the previous December. A week's quarter SHALL be the quarter of the month it belongs to. The year view's month and quarter headers, its month and quarter divider lines, and the month view SHALL all use this rule. The year view SHALL keep showing every ISO week of the year; only the grouping of weeks into months and quarters changes.

#### Scenario: A month view shows the weeks whose Monday is in that month

- **WHEN** the month view shows a month
- **THEN** its week columns MUST be exactly the weeks listed for that month below, in order

##### Example: weeks of a month

| Month | Week columns |
| ----- | ------------ |
| 2025-12 | 2025-W49, 2025-W50, 2025-W51, 2025-W52 |
| 2026-01 | 2026-W01, 2026-W02, 2026-W03, 2026-W04, 2026-W05 |
| 2026-03 | 2026-W10, 2026-W11, 2026-W12, 2026-W13, 2026-W14 |
| 2026-09 | 2026-W37, 2026-W38, 2026-W39, 2026-W40 |
| 2026-10 | 2026-W41, 2026-W42, 2026-W43, 2026-W44 |
| 2026-11 | 2026-W45, 2026-W46, 2026-W47, 2026-W48, 2026-W49 |
| 2026-12 | 2026-W50, 2026-W51, 2026-W52, 2026-W53 |
| 2027-01 | 2027-W01, 2027-W02, 2027-W03, 2027-W04 |

#### Scenario: The year view header uses the same rule

- **WHEN** the 2026 year view renders its month and quarter headers
- **THEN** each week below MUST sit under the month and quarter shown

##### Example: 2026 year header

| Week | Monday | Month | Quarter |
| ---- | ------ | ----- | ------- |
| W01 | 2025-12-29 | 1 月 | Q1 |
| W14 | 2026-03-30 | 3 月 | Q1 |
| W27 | 2026-06-29 | 6 月 | Q2 |
| W36 | 2026-08-31 | 8 月 | Q3 |
| W40 | 2026-09-28 | 9 月 | Q3 |
| W41 | 2026-10-05 | 10 月 | Q4 |
| W49 | 2026-11-30 | 11 月 | Q4 |
| W53 | 2026-12-28 | 12 月 | Q4 |

---
### Requirement: Switching between the year view and the month view

The dashboard SHALL show a two-option switch `年` / `月` in its controls row, with the active option marked. Pressing `M` (case-insensitive) SHALL toggle between the two, under the same conditions as the `T` shortcut (ignored with a modifier key held, while a text-entry element has focus, or when the dashboard tab is not active). The chosen view SHALL be stored in vault-scoped local storage under `dashboard.scale` with the value `year` or `month`, and SHALL be restored when the tab opens; a missing or unknown value SHALL mean `year`.

When the month view is shown, the controls row SHALL also show `◀`, the month title, `▶`, and `本月`. The title SHALL read `<year> 年 <month> 月（W<first week>–W<last week>）`, for example `2026 年 10 月（W41–W44）`. `◀` and `▶` SHALL show the previous and next month, crossing year boundaries; `本月` SHALL show the month that today's week belongs to. Week numbers in the title SHALL have no leading zero, matching the year view's week headers (`W1`, not `W01`). Changing the shown month or switching between the year view and the month view SHALL close any open week popover. Every time the dashboard switches into the month view or the tab opens in the month view, it SHALL show the month that today's week belongs to; the shown month SHALL NOT be stored.

#### Scenario: Opening the month view shows the current month

- **GIVEN** today is `2026-10-30`, in `2026-W44`
- **WHEN** the user picks `月`
- **THEN** the month view MUST show `2026 年 10 月（W41–W44）`
- **AND** pressing `▶` MUST show `2026 年 11 月（W45–W49）`
- **AND** pressing `▶` twice more MUST show `2027 年 1 月（W1–W4）`
- **AND** pressing `本月` MUST show `2026 年 10 月（W41–W44）` again

#### Scenario: Changing the month closes the popover

- **GIVEN** the month view shows `2026 年 10 月（W41–W44）` and a week popover is open
- **WHEN** the user presses `▶`
- **THEN** no week popover MUST be visible

#### Scenario: The choice survives a restart

- **GIVEN** the user switched to the month view and moved to `2026 年 12 月`
- **WHEN** the user relaunches Obsidian and opens the dashboard
- **THEN** the month view MUST be shown
- **AND** it MUST show the month of today's week, not December

#### Scenario: M toggles the view

- **GIVEN** the year view is shown and no input has focus
- **WHEN** the user presses `m`
- **THEN** the month view MUST be shown
- **AND** `dashboard.scale` MUST be `month`

---
### Requirement: Month view layout

The month view SHALL show the same project rows as the year view, in the same order and grouping, with the same category legend, sort controls, `顯示已結案` filter, `編輯分類` controls, project name links, and resizable project column. Its columns SHALL be: the project column; one column per week of the shown month, headed by the week number without a leading zero and its Monday–Sunday range (for example `W44` and `10/26–11/1`, or `W1` and `1/4–1/10`); and a last column headed `還沒排`. When today's week is one of the shown weeks, its column SHALL be highlighted as in the year view; otherwise no column SHALL be highlighted. The month view's week headers and cells SHALL use their own classes (`th.month-week`, `td.month-cell`), so the year view's fixed 32px week width does not apply to them. The week columns SHALL share the remaining width equally, so the month view needs no horizontal scrolling. A cell SHALL grow in height to fit its task lines; long task text SHALL wrap.

#### Scenario: Month columns

- **WHEN** the month view shows `2026-11`
- **THEN** the columns MUST be the project column, `W45 11/2–11/8`, `W46 11/9–11/15`, `W47 11/16–11/22`, `W48 11/23–11/29`, `W49 11/30–12/6`, and `還沒排`

---
### Requirement: Month cells list the week's task lines

Each week cell of the month view SHALL list the project's task lines for that week, using the same task lines, the same week mapping (including the `Saturday tasks count for next week` setting), and the same order as the week popover. Each listed line SHALL show its task text, styled by its state:

- a done line SHALL show `✓` before the text, and the text SHALL be greyed;
- an open line whose week ends before today's week starts (an overdue line) SHALL show its text in the warning red;
- any other open line SHALL show its text normally.

Each cell's kind SHALL be the result of applying the per-week cell model to the project and the shown month's weeks, for any month and any year the month view can show (it does not depend on which year the year view renders). The kinds are `solid`, `settled`, `overflow`, `dashed`, and `blank`; a run that the per-week model returns as one `span-dashed` bar SHALL appear as individual `dashed` cells. The cell's background and border SHALL follow its kind. A cell SHALL show no text when no task line maps to its week, and a `blank` cell SHALL show no text even when task lines map to its week, because it cannot be opened (for example a task dated before the project's start).

#### Scenario: A blank week shows no text

- **GIVEN** a project that starts on `2026-11-02` and whose note contains `- [ ] 前置作業 📅 2026-10-28`
- **WHEN** the month view shows `2026-10`
- **THEN** that project's `W44` cell MUST be `blank` and MUST show no text

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

---
### Requirement: Clicking a month cell opens the week popover

A month-view cell SHALL open the week popover for its project and week under the same eligibility as the year view: a cell whose kind is `solid`, `settled`, `overflow`, or `dashed` SHALL open it, and a `blank` cell SHALL NOT. The popover SHALL be anchored at the clicked cell and SHALL offer every action of the week popover; for an `overflow` cell its header SHALL show the same `⚠ 已超出預計結束日期 <end>` line as in the year view. Clicking the same cell again SHALL close it, and the dismissal rules of the week popover SHALL apply unchanged.

#### Scenario: Editing from the month view

- **GIVEN** the month view shows `2026-10` and the `W44` cell of `範例專案 A` lists `確認拍攝服裝`
- **WHEN** the user clicks that cell and ticks `確認拍攝服裝` in the popover
- **THEN** after the re-render the `W44` cell MUST list `✓ 確認拍攝服裝` greyed
- **AND** the popover for `範例專案 A` and `2026-W44` MUST still be open

---
### Requirement: Unscheduled task count per project

The `還沒排` column SHALL show, for each project row, the number of the project's unscheduled tasks (as defined by the week popover's unscheduled list), and SHALL be empty when the number is 0. Hovering a non-empty cell SHALL show a tooltip listing those tasks' texts, one per line, in line order. The column SHALL NOT open the popover or change the note.

#### Scenario: Count and tooltip

- **GIVEN** a project's note contains the unchecked lines `- [ ] 製作學習日曆` and `- [ ] 整理名單` without any date
- **WHEN** the month view renders that project's row
- **THEN** its `還沒排` cell MUST show `2`
- **AND** its tooltip MUST list `製作學習日曆` and `整理名單` on separate lines
