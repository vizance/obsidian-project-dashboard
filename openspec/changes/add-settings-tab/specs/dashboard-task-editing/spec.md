## MODIFIED Requirements

### Requirement: Popover lists the week's task lines with controls

The week popover for a project and an ISO week SHALL list each task line of that project for which at least one date in `dates` maps to that week under the occupied rule (each date maps to its own ISO week, except that a Saturday maps to the following ISO week when the `週六的任務算到下一週` setting is on). Each task line SHALL appear at most once, even when several of its dates map to the week. Rows SHALL be sorted by the earliest of the line's dates that maps to the week, then by line index.

The popover SHALL show a two-line header: the project name, then the ISO week and its Monday–Sunday range, for example `W44　10/26（一）– 11/1（日）`. When the week lies in the project's overflow range, the header SHALL add `⚠ 已超出預計結束日期 <end>`. When no task line maps to the week, the list SHALL show `這週還沒有任務`.

Each row SHALL show the task text and a date label: `<M/D>（<weekday>）` of `due` for an open line, `已完成 <M/D>` of `doneDate` for a done line (`已完成` alone when a done line has no `doneDate`), plus, when the date shown is a Saturday mapped into this week from the previous week, `預排在上週六，算進本週` for an open line or `上週六完成，算進本週` for a done line. Each row SHALL offer:

- a checkbox reflecting `done`, enabled only when `checkbox = true` and `recurring = false`; for a recurring line it SHALL be disabled with the tooltip `重複任務請在筆記裡勾選`
- `◀` and `▶` buttons, shown only when `checkbox = true`, `done = false`, and `due` is not null
- a `↗` button on every row

While a write for a row is in flight, that row's controls SHALL be disabled and its checkbox SHALL show the requested state until the next re-render.

#### Scenario: A line with two dates in the same week appears once

- **GIVEN** the line `- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26`
- **WHEN** the popover for `2026-W44` opens
- **THEN** exactly one row for `租借場地` MUST be listed, labelled `已完成 10/26`

#### Scenario: Saturday task shows in the following week when the setting is on

- **GIVEN** the line `- [ ] 寄出合約 📅 2026-10-31` (Saturday) and `週六的任務算到下一週` on
- **WHEN** the popover for `2026-W45` opens
- **THEN** a row for `寄出合約` MUST be listed with the label `10/31（六）` and `預排在上週六，算進本週`
- **AND** the popover for `2026-W44` MUST NOT list it

#### Scenario: Saturday task stays in its own week when the setting is off

- **GIVEN** the line `- [ ] 寄出合約 📅 2026-10-31` (Saturday) and `週六的任務算到下一週` off
- **WHEN** the popover for `2026-W44` opens
- **THEN** a row for `寄出合約` MUST be listed with the label `10/31（六）` and without `預排在上週六，算進本週`
- **AND** the popover for `2026-W45` MUST NOT list it

#### Scenario: Non-checkbox dated line is read-only

- **GIVEN** the line `會議紀錄 📅 2026-10-29`
- **WHEN** the popover for `2026-W44` opens
- **THEN** its row MUST show a disabled checkbox and no `◀` `▶` buttons
- **AND** its `↗` button MUST be available

---
### Requirement: Scheduling an unscheduled task into the week

The popover footer SHALL offer `＋ 從還沒排日期的任務挑一個（N）`, where N is the number of the project's unscheduled tasks. Activating it SHALL expand a list of those tasks in line order, or the text `這則筆記沒有還沒排日期的任務` when N is 0. Clicking a listed task SHALL append ` 📅 <schedule date>` to that line (before a trailing block reference, by the same rule as completion).

The schedule date SHALL be derived from the popover's ISO week and the `排進某週時寫星期幾` setting (`scheduleWeekday`, 1 = Monday … 7 = Sunday, default 5 = Friday): it SHALL be the week's Monday plus `scheduleWeekday − 1` days, except that when `scheduleWeekday` is 6 (Saturday) and the `週六的任務算到下一週` setting is on, it SHALL be the Saturday before the week's Monday (the Monday minus 2 days). Under both settings the scheduled line SHALL therefore map to the popover's week.

#### Scenario: Picking an unscheduled task schedules it on the configured weekday

- **WHEN** the user picks an unscheduled task in the popover of a week
- **THEN** the note line MUST gain the schedule date of that week
- **AND** after the re-render the task MUST be listed in that same week's popover

##### Example: schedule dates with the default settings

| Week | Before | After |
| ---- | ------ | ----- |
| 2026-W45 | `- [ ] 製作學習日曆` | `- [ ] 製作學習日曆 📅 2026-11-06` |
| 2026-W53 | `- [ ] 年度回顧` | `- [ ] 年度回顧 📅 2027-01-01` |
| 2027-W01 | `- [ ] 新年計畫 ^plan1` | `- [ ] 新年計畫 📅 2027-01-08 ^plan1` |
| 2027-W02 | `- [ ] 新年計畫 ^plan1 ` (one trailing space) | `- [ ] 新年計畫 📅 2027-01-15 ^plan1 ` |

##### Example: schedule date by setting

| Week | `排進某週時寫星期幾` | `週六的任務算到下一週` | Schedule date |
| ---- | -------------------- | ---------------------- | ------------- |
| 2026-W45 | 星期五 | off | `2026-11-06` |
| 2026-W45 | 星期五 | on | `2026-11-06` |
| 2026-W45 | 星期一 | off | `2026-11-02` |
| 2026-W45 | 星期六 | off | `2026-11-07` |
| 2026-W45 | 星期六 | on | `2026-10-31` |
| 2026-W45 | 星期日 | on | `2026-11-08` |
| 2027-W01 | 星期六 | on | `2027-01-02` |

#### Scenario: No unscheduled tasks

- **GIVEN** a project whose note has no unscheduled task
- **WHEN** the user expands the unscheduled list
- **THEN** the popover MUST show `這則筆記沒有還沒排日期的任務`

---
### Requirement: Moving a task to the previous or next week

Clicking `▶` SHALL replace the first `📅` date of the line with the date 7 days later; clicking `◀` SHALL replace it with the date 7 days earlier. The weekday SHALL therefore be preserved. No other part of the line SHALL change. The week in which the moved line is shown SHALL follow the occupied rule with the current `週六的任務算到下一週` setting.

#### Scenario: Arrows shift the due date by one week

- **WHEN** the user clicks an arrow on an open task line with a due date
- **THEN** the note line MUST change exactly as in the example table

##### Example: shift rewrites

| Before | Button | After | Week shown after (Saturday setting off) | Week shown after (Saturday setting on) |
| ------ | ------ | ----- | --------------------------------------- | -------------------------------------- |
| `- [ ] 確認拍攝服裝 📅 2026-10-30` | ▶ | `- [ ] 確認拍攝服裝 📅 2026-11-06` | 2026-W45 | 2026-W45 |
| `- [ ] 寄出合約 📅 2026-10-31` | ▶ | `- [ ] 寄出合約 📅 2026-11-07` | 2026-W45 | 2026-W46 |
| `- [ ] 年度回顧 📅 2026-01-02` | ◀ | `- [ ] 年度回顧 📅 2025-12-26` | 2025-W52 | 2025-W52 |
