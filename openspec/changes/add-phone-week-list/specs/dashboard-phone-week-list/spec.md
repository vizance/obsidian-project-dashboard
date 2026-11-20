## ADDED Requirements

### Requirement: Phone layout is chosen by Obsidian's phone check

When a dashboard tab opens, the dashboard SHALL read Obsidian's `Platform.isPhone` once. When it is true, the tab SHALL show the phone week list described in this capability; otherwise the tab SHALL show the year view or the month view exactly as before. The choice SHALL NOT change while the tab stays open — rotating the device, resizing the window, or narrowing the pane never switches layouts — and it SHALL be made again only when a dashboard tab opens. The width of the window or pane SHALL NOT be used to choose the layout.

On a phone, the dashboard tab SHALL NOT show the controls row (other than `顯示暫停（<n>）`), the `年` / `月` switch, the year and month navigation, `顯示已結案`, `編輯分類與狀態`, the legend, the `⚠` markers, the help-fab, or the help-panel, and it SHALL NOT render the year view, the month view, or the Timeline view-mode. On a phone the keyboard shortcuts `M`, `T`, and `?` SHALL do nothing, including from an external keyboard. When the project folder is missing or holds no shown project, the phone layout SHALL show the same message text that the desktop dashboard shows in that case, for example `找不到專案資料夾：<folder>`.

#### Scenario: A phone gets the week list

- **GIVEN** Obsidian reports `Platform.isPhone` as true
- **WHEN** the user opens the dashboard
- **THEN** the tab MUST show the phone week list
- **AND** it MUST NOT show the `年` / `月` switch, the legend, or the `?` help button

#### Scenario: A tablet keeps the year and month views

- **GIVEN** Obsidian reports `Platform.isPhone` as false and `Platform.isTablet` as true
- **WHEN** the user opens the dashboard
- **THEN** the tab MUST show the year view or the month view with the same controls as on a computer

#### Scenario: A narrow desktop pane keeps the desktop layout

- **GIVEN** Obsidian reports `Platform.isPhone` as false
- **WHEN** the user narrows the dashboard pane to 380 pixels wide
- **THEN** the tab MUST keep showing the year view or the month view

#### Scenario: Shortcuts do nothing on a phone

- **GIVEN** the phone week list is shown
- **WHEN** the user presses `M` on an external keyboard
- **THEN** the layout MUST stay the phone week list
- **AND** `dashboard.scale` MUST NOT be written

---
### Requirement: The phone week list shows this week and the next three weeks

The phone week list SHALL show four ISO weeks from top to bottom: the ISO week (Monday to Sunday) that contains today's local date, followed by the three ISO weeks after it, crossing into the next ISO year when needed. Today's week SHALL be found by today's date alone, without the Saturday rule, the same as the week the month view marks as today. Each week SHALL have a heading made of a label, the week number written as `W<week>` without a leading zero, and the week's range written as `M/D–M/D`. The label SHALL be `本週` for the first week, `下週` for the second week, and empty for the third and fourth weeks.

Below each heading the list SHALL show one group per project that has at least one task line in that week, in the same order and with the same filter as the dashboard's rows: closed projects (done or cancelled) are never shown on a phone, paused projects are shown only while `顯示暫停（<n>）` is checked, and projects without both a start and an end date are not shown. `顯示暫停（<n>）` SHALL follow the same rules as on a computer: it appears only when `<n>` is greater than 0, it counts the same projects, and it is unchecked whenever the dashboard tab opens. Each group SHALL start with the project's category color dot and the project's name, followed by the task lines that map to that week under the same week rule the month view uses — including the `Saturday tasks count as next week` setting — in the same order the week-popover lists them. A project with no task line in that week SHALL NOT have a group in that week. A week in which no shown project has a task line SHALL show the single grey line `這週沒有任務`. Task lines whose dates map only to weeks after the fourth week SHALL NOT appear anywhere in the list.

Each task line row SHALL show a checkbox, the task's display text, and, when the line has a `📅` date, that date written as `M/D`. A done line SHALL show a checked checkbox and grey text. The task text SHALL wrap onto more lines when needed and SHALL NOT be cut off.

#### Scenario: Four weeks from today

- **GIVEN** today is 2026-11-20 (a Friday in W47)
- **WHEN** the user opens the dashboard on a phone
- **THEN** the week headings MUST read, from top to bottom, `本週 W47 11/16–11/22`, `下週 W48 11/23–11/29`, `W49 11/30–12/6`, and `W50 12/7–12/13`

##### Example: where each task appears

- **GIVEN** today is 2026-11-20, the `Saturday tasks count as next week` setting is off, and the active project `範例專案 A` has these lines:
  - `- [ ] 寄出邀請 📅 2026-11-06`
  - `- [ ] 準備讀書會 📅 2026-11-20`
  - `- [ ] 訂場地 📅 2026-12-11`
  - `- [ ] 寄成果報告 📅 2026-12-18`
- **WHEN** the user opens the dashboard on a phone
- **THEN** the results MUST be:

| Line | Shown in | Notes |
| ---- | -------- | ----- |
| `寄出邀請` | `之前還沒做`, not in any week | its week W45 has passed |
| `準備讀書會` | `本週 W47`, with `11/20` | today's week |
| `訂場地` | `W50`, with `12/11` | the fourth week |
| `寄成果報告` | nowhere | W51 is after the fourth week |

- **AND** `下週 W48` and `W49` MUST each show `這週沒有任務`

#### Scenario: The four weeks cross into the next year

- **GIVEN** today is 2026-12-30
- **WHEN** the user opens the dashboard on a phone
- **THEN** the week headings MUST read `本週 W53 12/28–1/3`, `下週 W1 1/4–1/10`, `W2 1/11–1/17`, and `W3 1/18–1/24`

#### Scenario: The Saturday rule decides the week

- **GIVEN** today is 2026-11-20, the `Saturday tasks count as next week` setting is on, and an active project has `- [ ] 整理照片 📅 2026-11-28`
- **WHEN** the user opens the dashboard on a phone
- **THEN** `整理照片` MUST be listed under `W49 11/30–12/6`
- **AND** it MUST NOT be listed under `下週 W48 11/23–11/29`

#### Scenario: Projects follow the dashboard's row order

- **GIVEN** two active projects with tasks in W47, and the dashboard's rows list `範例專案 B` above `範例專案 A`
- **WHEN** the user opens the dashboard on a phone
- **THEN** under `本週 W47` the group `範例專案 B` MUST come before the group `範例專案 A`

#### Scenario: Paused projects appear only when checked

- **GIVEN** a paused project with a task in W47 and no other paused project
- **WHEN** the user opens the dashboard on a phone
- **THEN** `顯示暫停（1）` MUST be shown unchecked and the paused project's task MUST NOT be listed
- **WHEN** the user checks `顯示暫停（1）`
- **THEN** the paused project's group MUST appear under `本週 W47`

#### Scenario: A done task stays in its week

- **GIVEN** today is 2026-11-20 and an active project has `- [x] 整理閱讀清單 📅 2026-11-19 ✅ 2026-11-19`
- **WHEN** the user opens the dashboard on a phone
- **THEN** `整理閱讀清單` MUST be listed under `本週 W47` with a checked checkbox and grey text

---
### Requirement: Task lines are edited from the phone week list

Each row in the four weeks SHALL carry its editing controls directly on the row; the phone week list SHALL NOT open the week-popover. The controls SHALL follow the week-popover's rules:

- The checkbox SHALL be enabled only for a checkbox task that is not recurring. For a recurring task the checkbox SHALL be disabled and carry the same hint as the week-popover, `重複任務請在筆記裡勾選`. Changing an enabled checkbox SHALL toggle the line done or not done through the same write path as the week-popover, writing `✅ <today>` when ticking and removing the `✅` date when unticking.
- `◀` and `▶` SHALL appear only on a checkbox task that is not done and has a `📅` date. Pressing one SHALL move that line's first `📅` date 7 days earlier or later through the same write path as the week-popover. A done line, a line without a `📅` date, and a line without a checkbox SHALL show neither.
- While a write for a row is running, that row's controls SHALL be disabled; they SHALL be enabled again when the write finishes.
- When a write fails, the dashboard SHALL show the same message as the week-popover and the note SHALL stay unchanged: `找不到這則筆記` when the note is missing; `這一行在筆記裡剛被改過，畫面已更新，請再試一次` when the line changed since the last scan, after which the dashboard re-scans; `寫入筆記失敗，請再試一次` when reading or writing the note fails.

After a successful `◀` or `▶`, the dashboard SHALL find the week of the new `📅` date under the week rule. When that week is before today's week it SHALL show the message `已移到 <M/D>，在「之前還沒做」裡`; when it is after the fourth week it SHALL show `已移到 <M/D>，超出這 4 週`; when it is one of the four weeks it SHALL show no message.

Every checkbox, `◀`, `▶`, `排到本週` button, the `之前還沒做` heading row, and every project name SHALL have a tap area at least 44 × 44 CSS pixels.

#### Scenario: Ticking a task on a phone

- **GIVEN** today is 2026-11-20 and `範例專案 A` has `- [ ] 準備讀書會 📅 2026-11-20`
- **WHEN** the user ticks `準備讀書會` under `本週 W47`
- **THEN** the note line MUST become `- [x] 準備讀書會 📅 2026-11-20 ✅ 2026-11-20`
- **AND** `準備讀書會` MUST stay under `本週 W47` with a checked checkbox and grey text

#### Scenario: Moving a task one week later

- **GIVEN** today is 2026-11-20 and `範例專案 A` has `- [ ] 準備讀書會 📅 2026-11-20`
- **WHEN** the user presses `▶` on `準備讀書會`
- **THEN** the note line MUST become `- [ ] 準備讀書會 📅 2026-11-27`
- **AND** `準備讀書會` MUST be listed under `下週 W48 11/23–11/29`
- **AND** no message MUST be shown

#### Scenario: Moving a task past the fourth week

- **GIVEN** today is 2026-11-20 and `範例專案 A` has `- [ ] 訂場地 📅 2026-12-11`
- **WHEN** the user presses `▶` on `訂場地`
- **THEN** the note line MUST become `- [ ] 訂場地 📅 2026-12-18`
- **AND** the message `已移到 12/18，超出這 4 週` MUST be shown

#### Scenario: Moving a task before this week

- **GIVEN** today is 2026-11-20 and `範例專案 A` has `- [ ] 準備讀書會 📅 2026-11-16`
- **WHEN** the user presses `◀` on `準備讀書會`
- **THEN** the note line MUST become `- [ ] 準備讀書會 📅 2026-11-09`
- **AND** the message `已移到 11/9，在「之前還沒做」裡` MUST be shown
- **AND** the count in `之前還沒做（<n>）` MUST grow by one

#### Scenario: A recurring task cannot be ticked on a phone

- **GIVEN** an active project has `- [ ] 週報 🔁 every week 📅 2026-11-20`
- **WHEN** the user opens the dashboard on a phone on 2026-11-20
- **THEN** the checkbox of `週報` MUST be disabled with the hint `重複任務請在筆記裡勾選`
- **AND** `◀` and `▶` MUST be shown on `週報`

#### Scenario: A changed line is not overwritten

- **GIVEN** the phone week list shows `準備讀書會` and the line was edited in the note after the last scan
- **WHEN** the user presses `▶` on `準備讀書會`
- **THEN** the note MUST stay unchanged
- **AND** the message `這一行在筆記裡剛被改過，畫面已更新，請再試一次` MUST be shown

---
### Requirement: Overdue tasks are kept in the 之前還沒做 section

An overdue line SHALL be a task line that has a checkbox, is not done, has a `📅` date, and whose `📅` date maps under the week rule to a week whose Monday is before the Monday of today's week. Only lines of projects shown in the phone week list SHALL count. A line whose only dates are in today's week or later SHALL NOT be overdue, even when its date is before today.

The top of the phone week list, below `顯示暫停（<n>）`, SHALL show the heading row `之前還沒做（<n>）`, where `<n>` is the number of overdue lines. The section SHALL be collapsed whenever the dashboard tab opens, with `▸` before the heading; tapping the heading row SHALL expand it, showing `▾`, and tapping again SHALL collapse it. A re-render of the dashboard — for example after a note change — SHALL keep the section expanded or collapsed as it was and keep the scroll position.

When expanded, the section SHALL list the overdue lines grouped by project in the dashboard's row order, each group starting with the category color dot and project name, and within a project sorted by `📅` date and then by line order. Each row SHALL show red text, the `📅` date as `M/D`, a checkbox following the same rules as in the four weeks, and the button `排到本週`. Rows in this section SHALL NOT show `◀` or `▶`.

Pressing `排到本週` SHALL change the line's first `📅` date to the schedule date of today's week — the date the week-popover writes when scheduling a task into that week, following the `Which day to write` setting and its Saturday exception — through the same write path as the week-popover's `◀` and `▶`, without adding another `📅` date to the line; any later `📅` date on the line stays as it is. The line then SHALL appear in today's week and leave the section.

A row ticked inside this section SHALL stay in the section, grey and checked, until the section is collapsed or the dashboard tab is opened again, so that a mistaken tick can be undone there; unticking it SHALL make it red and open again. `<n>` SHALL count only the lines that are not done. While the section is collapsed and `<n>` is 0, the heading row SHALL NOT be shown. While the section is expanded and `<n>` becomes 0, the heading row SHALL stay, reading `之前還沒做（0）`, until the section is collapsed.

#### Scenario: Scheduling an overdue task into this week

- **GIVEN** today is 2026-11-20, `Which day to write` is Friday, and `範例專案 A` has `- [ ] 寄出邀請 📅 2026-11-06` as its only overdue line
- **WHEN** the user opens the dashboard on a phone
- **THEN** the heading row `▸ 之前還沒做（1）` MUST be shown and `寄出邀請` MUST NOT be visible
- **WHEN** the user taps the heading row and presses `排到本週` on `寄出邀請`
- **THEN** the note line MUST become `- [ ] 寄出邀請 📅 2026-11-20`
- **AND** `寄出邀請` MUST be listed under `本週 W47`
- **AND** the heading row MUST read `之前還沒做（0）` until the user collapses the section, after which it MUST NOT be shown

#### Scenario: Scheduling into this week with the Saturday exception

- **GIVEN** today is 2026-11-20, `Which day to write` is Saturday, the `Saturday tasks count as next week` setting is on, and an overdue line `- [ ] 寄出邀請 📅 2026-11-06`
- **WHEN** the user presses `排到本週` on `寄出邀請`
- **THEN** the note line MUST become `- [ ] 寄出邀請 📅 2026-11-14`
- **AND** `寄出邀請` MUST be listed under `本週 W47`

#### Scenario: A ticked overdue task stays until the section closes

- **GIVEN** the section is expanded and lists `寄出邀請` and `訂機票`
- **WHEN** the user ticks `寄出邀請`
- **THEN** `寄出邀請` MUST stay in the section with a checked checkbox and grey text
- **AND** the heading row MUST read `之前還沒做（1）`
- **WHEN** the user collapses and expands the section again
- **THEN** only `訂機票` MUST be listed

#### Scenario: Earlier days of this week are not overdue

- **GIVEN** today is 2026-11-20 and an active project has `- [ ] 回覆信件 📅 2026-11-16`
- **WHEN** the user opens the dashboard on a phone
- **THEN** `回覆信件` MUST be listed under `本週 W47` in normal (not red) text
- **AND** it MUST NOT count in `之前還沒做（<n>）`

#### Scenario: No overdue tasks, no heading

- **GIVEN** no shown project has an overdue line
- **WHEN** the user opens the dashboard on a phone
- **THEN** no `之前還沒做` heading row MUST be shown

---
### Requirement: A project note opens in the dashboard's tab on a phone

On a phone, tapping a project name in the four weeks or in the `之前還沒做` section SHALL open that project's note in the dashboard's own tab, so that Obsidian's back control returns to the dashboard. On a computer or tablet, the project name SHALL keep opening the note in the split to the right, reusing that split, as before.

#### Scenario: Opening a note and going back

- **GIVEN** the phone week list lists the group `範例專案 A`
- **WHEN** the user taps `範例專案 A`
- **THEN** the note of `範例專案 A` MUST open in the dashboard's tab
- **AND** pressing Obsidian's back control MUST show the phone week list again

---
### Requirement: Calendars are not set up or read on a phone

On a phone, the plugin SHALL NOT call Obsidian's secret storage, SHALL NOT read any calendar, and SHALL NOT show any calendar event. The Calendars section of the settings tab SHALL show its heading and the single sentence `Calendar events show on a computer or tablet. Add your calendars there.`, with no name field, link field, color picker, delete button, or `Add a calendar` button. Saving any other setting on a phone SHALL keep the `calendars` list in plugin data unchanged.

#### Scenario: Settings on a phone

- **GIVEN** plugin data has one calendar named `工作` with a secret ID
- **WHEN** the user opens Settings → Project Dashboard on a phone
- **THEN** the Calendars section MUST show only its heading and `Calendar events show on a computer or tablet. Add your calendars there.`
- **AND** no call to Obsidian's secret storage MUST be made

#### Scenario: Other settings keep the calendars

- **GIVEN** plugin data has one calendar named `工作` with a secret ID
- **WHEN** the user changes `Project folder` on a phone
- **THEN** the saved plugin data MUST still have the calendar `工作` with the same secret ID and color
