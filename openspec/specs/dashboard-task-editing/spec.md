# dashboard-task-editing Specification

## Purpose

Let the user change a project's task lines from the week popover (tick or untick, move by a week, schedule an unscheduled task, add a new task, jump to the line, open the note) while every write goes through one writer that checks the line has not changed first.

## Requirements

### Requirement: Scanner exposes task lines per project

The scanner SHALL add a `task_lines` field to every project record: an array of task lines sorted by line index. A line SHALL count as a task line when it is a checkbox task — optional leading whitespace, a `-`, `*`, or `+` bullet, whitespace, then `[ ]`, `[x]`, or `[X]` — or when it contains at least one `📅` or `✅` token followed by whitespace and an ISO `YYYY-MM-DD` date. Every other line SHALL be skipped. Each task line SHALL carry:

- `line`: the 0-based line index in the note at scan time
- `raw`: the exact line text without its line terminator
- `text`: the display text, using the existing task-text cleaning rule (bullet and checkbox removed, everything from the first ` > ` cut, `📅`/`✅` date markers removed, whitespace collapsed)
- `checkbox`: true when the line is a checkbox task as defined above
- `done`: true when the checkbox is `[x]`/`[X]` or the line contains a `✅` date marker (`✅`, whitespace, ISO date), the same completion rule as `dashboard-gantt-rendering`
- `due`: the first `📅` date, or `null`
- `doneDate`: the first `✅` date, or `null`
- `recurring`: true when the line contains `🔁`
- `dates`: every `📅`/`✅` date on the line, in order of appearance

Checkbox states other than `[ ]`, `[x]`, `[X]` (for example `[/]` or `[-]`) SHALL NOT count as checkbox tasks. Lines inside a fenced code block (opened and closed by a line starting with ```` ``` ```` or `~~~`) or inside the leading YAML frontmatter (a first line `---` up to the next `---` line) SHALL NOT count as checkbox tasks either: such a line is a task line only when it carries a date, and then with `checkbox = false`, so it is shown read-only and never written. Apart from the completion rule clarified in `dashboard-gantt-rendering` (a `✅` without a date no longer completes a task), adding `task_lines` SHALL NOT change the value or computation of `tasks`, `task_dates`, `promised_end`, `overflow_end`, `occupied_weeks`, or `settled_weeks`.

#### Scenario: Mixed note produces task lines

- **WHEN** the scanner processes a note
- **THEN** `task_lines` MUST contain exactly the checkbox lines and the dated lines, in line order, with the fields listed above

##### Example: one note, five lines

| Line | Raw | In task_lines | checkbox | done | due | doneDate | dates |
| ---- | --- | ------------- | -------- | ---- | --- | -------- | ----- |
| 0 | `## 拍攝` | no | | | | | |
| 1 | `- [ ] 確認拍攝服裝 📅 2026-10-30` | yes | true | false | 2026-10-30 | null | [2026-10-30] |
| 2 | `- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26` | yes | true | true | 2026-10-27 | 2026-10-26 | [2026-10-27, 2026-10-26] |
| 3 | `  - [ ] 製作學習日曆` | yes | true | false | null | null | [] |
| 4 | `會議紀錄 📅 2026-10-29` | yes | false | false | 2026-10-29 | null | [2026-10-29] |

#### Scenario: Custom checkbox status stays read-only

- **WHEN** a note contains `- [/] 剪輯第一支影片 📅 2026-10-29`
- **THEN** that line MUST appear in `task_lines` with `checkbox = false` because it carries a date
- **AND** a note line `- [-] 取消的任務` with no date MUST NOT appear in `task_lines`

#### Scenario: Lines in code fences and frontmatter stay read-only

- **WHEN** the scanner processes a note
- **THEN** checkbox-looking lines inside a code fence or the frontmatter MUST NOT be checkbox tasks

##### Example: fenced and frontmatter lines

| Line | Raw | In task_lines | checkbox |
| ---- | --- | ------------- | -------- |
| 0 | `---` | no | |
| 1 | `tags: [project]` | no | |
| 2 | `---` | no | |
| 3 | `- [ ] 真的任務` | yes | true |
| 4 | ```` ```md ```` | no | |
| 5 | `- [x] 範例任務 📅 2026-11-06` | yes | false |
| 6 | `- [ ] 範例待辦` | no | |
| 7 | ```` ``` ```` | no | |

#### Scenario: Existing fields unchanged

- **GIVEN** any note that was scanned before this change
- **WHEN** it is scanned after this change
- **THEN** every field other than `task_lines` MUST be identical to its previous value, except for a line whose only `✅` is not followed by a date, which is no longer complete

#### Scenario: A link to a finished note does not mark a task done

- **GIVEN** the line `- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]] 📅 2026-11-07`
- **WHEN** the scanner processes the note
- **THEN** its task line MUST have `done = false`, `due = 2026-11-07`, and `dates = [2026-11-07]`

---
### Requirement: Unscheduled tasks

An unscheduled task SHALL be a task line with `checkbox = true`, `done = false`, an empty `dates` list, and no date-like marker: no `📅` character anywhere on the line and no `✅` followed (after an optional U+FE0F and optional whitespace) by a digit. A variant or malformed marker such as `📅️ 2026-11-06` is left to the note rather than scheduled a second time, while a `✅` inside a link such as `[[✅ P-2026 範例：已完成專案]]` does not block scheduling. The unscheduled tasks of a project SHALL be listed in line order.

#### Scenario: Only open undated checkbox lines count

- **GIVEN** the five-line note from the task-lines example
- **WHEN** the unscheduled tasks are computed
- **THEN** the result MUST be exactly line 3 `製作學習日曆`

#### Scenario: A variant date marker is not offered for scheduling

- **GIVEN** the line `- [ ] 任務 📅️ 2026-11-06` (calendar emoji followed by U+FE0F)
- **WHEN** the unscheduled tasks are computed
- **THEN** that line MUST NOT be in the result

#### Scenario: A link to a finished note can still be scheduled

- **GIVEN** the line `- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]]` with no date
- **WHEN** the unscheduled tasks are computed
- **THEN** that line MUST be in the result

---
### Requirement: Popover lists the week's task lines with controls

The week popover for a project and an ISO week SHALL list each task line of that project for which at least one date in `dates` maps to that week under the occupied rule (Monday–Friday and Sunday map to their own ISO week; Saturday maps to the following ISO week). Each task line SHALL appear at most once, even when several of its dates map to the week. Rows SHALL be sorted by the earliest of the line's dates that maps to the week, then by line index.

The popover SHALL show a two-line header: the project name, then the ISO week and its Monday–Sunday range, for example `W44　10/26（一）– 11/1（日）`. When the week lies in the project's overflow range, the header SHALL add `⚠ 已超出預計結束日期 <end>`. When no task line maps to the week, the list SHALL show `這週還沒有任務`.

Each row SHALL show the task text and a date label: `<M/D>（<weekday>）` of `due` for an open line, `已完成 <M/D>` of `doneDate` for a done line (`已完成` alone when a done line has no `doneDate`), plus, when the date shown is a Saturday mapped into this week, `預排在上週六，算進本週` for an open line or `上週六完成，算進本週` for a done line. Each row SHALL offer:

- a checkbox reflecting `done`, enabled only when `checkbox = true` and `recurring = false`; for a recurring line it SHALL be disabled with the tooltip `重複任務請在筆記裡勾選`
- `◀` and `▶` buttons, shown only when `checkbox = true`, `done = false`, and `due` is not null
- a `↗` button on every row

While a write for a row is in flight, that row's controls SHALL be disabled and its checkbox SHALL show the requested state until the next re-render.

#### Scenario: A line with two dates in the same week appears once

- **GIVEN** the line `- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26`
- **WHEN** the popover for `2026-W44` opens
- **THEN** exactly one row for `租借場地` MUST be listed, labelled `已完成 10/26`

#### Scenario: Saturday task shows in the following week

- **GIVEN** the line `- [ ] 寄出合約 📅 2026-10-31` (Saturday)
- **WHEN** the popover for `2026-W45` opens
- **THEN** a row for `寄出合約` MUST be listed with the label `10/31（六）` and `預排在上週六，算進本週`
- **AND** the popover for `2026-W44` MUST NOT list it

#### Scenario: Non-checkbox dated line is read-only

- **GIVEN** the line `會議紀錄 📅 2026-10-29`
- **WHEN** the popover for `2026-W44` opens
- **THEN** its row MUST show a disabled checkbox and no `◀` `▶` buttons
- **AND** its `↗` button MUST be available

---
### Requirement: Completing and reopening a task

Clicking an enabled checkbox SHALL rewrite that task line through the task writer. When the line is open (`done = false`), the checkbox SHALL become `[x]` and, when the line has no `✅` marker, ` ✅ <today>` SHALL be appended, where today is the local calendar date. When the line is done, the checkbox SHALL become `[ ]` and every ` ✅ YYYY-MM-DD` marker SHALL be removed. When the line ends with a block reference (` ^` followed by letters, digits, or `-`, optionally followed by trailing whitespace), a new marker SHALL be inserted before the block reference, and the block reference and its trailing whitespace SHALL stay at the end of the line. All other characters of the line SHALL be preserved.

#### Scenario: Toggle rewrites the line

- **WHEN** the user clicks the checkbox of a task line
- **THEN** the note line MUST change exactly as in the example table

##### Example: completion rewrites (today = 2026-10-28)

| Before | After |
| ------ | ----- |
| `- [ ] 確認拍攝服裝 📅 2026-10-30` | `- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28` |
| `- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28` | `- [ ] 確認拍攝服裝 📅 2026-10-30` |
| `- [ ] 確認拍攝服裝 📅 2026-10-30 ^abc123` | `- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28 ^abc123` |
| `- [ ] 回覆信件 ✅ 2026-10-20` (open checkbox, has ✅, so done) | `- [ ] 回覆信件` |
| `	- [ ] 子任務 📅 2026-10-29` (tab-indented) | `	- [x] 子任務 📅 2026-10-29 ✅ 2026-10-28` |
| `- [ ] 確認拍攝服裝 📅 2026-10-30 ^abc123 ` (one trailing space) | `- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28 ^abc123 ` |

#### Scenario: Recurring task is not toggled

- **GIVEN** the line `- [ ] 週報 🔁 every week 📅 2026-10-30`
- **WHEN** the popover for `2026-W44` opens
- **THEN** its checkbox MUST be disabled
- **AND** the note MUST NOT be written when the user clicks it

---
### Requirement: Moving a task to the previous or next week

Clicking `▶` SHALL replace the first `📅` date of the line with the date 7 days later; clicking `◀` SHALL replace it with the date 7 days earlier. The weekday SHALL therefore be preserved. No other part of the line SHALL change.

#### Scenario: Arrows shift the due date by one week

- **WHEN** the user clicks an arrow on an open task line with a due date
- **THEN** the note line MUST change exactly as in the example table

##### Example: shift rewrites

| Before | Button | After | Week shown after |
| ------ | ------ | ----- | ---------------- |
| `- [ ] 確認拍攝服裝 📅 2026-10-30` | ▶ | `- [ ] 確認拍攝服裝 📅 2026-11-06` | 2026-W45 |
| `- [ ] 寄出合約 📅 2026-10-31` | ▶ | `- [ ] 寄出合約 📅 2026-11-07` | 2026-W46 |
| `- [ ] 年度回顧 📅 2026-01-02` | ◀ | `- [ ] 年度回顧 📅 2025-12-26` | 2025-W52 |

---
### Requirement: Scheduling an unscheduled task into the week

The popover footer SHALL offer `＋ 從還沒排日期的任務挑一個（N）`, where N is the number of the project's unscheduled tasks. Activating it SHALL expand a list of those tasks in line order, or the text `這則筆記沒有還沒排日期的任務` when N is 0. Clicking a listed task SHALL append ` 📅 <schedule date>` to that line (before a trailing block reference, by the same rule as completion), where the schedule date is the Friday of the popover's ISO week (its Monday plus 4 days). In this version the schedule weekday SHALL be fixed and SHALL NOT be configurable.

#### Scenario: Picking an unscheduled task schedules it on Friday

- **WHEN** the user picks an unscheduled task in the popover of a week
- **THEN** the note line MUST gain the Friday date of that week

##### Example: schedule dates

| Week | Before | After |
| ---- | ------ | ----- |
| 2026-W45 | `- [ ] 製作學習日曆` | `- [ ] 製作學習日曆 📅 2026-11-06` |
| 2026-W53 | `- [ ] 年度回顧` | `- [ ] 年度回顧 📅 2027-01-01` |
| 2027-W01 | `- [ ] 新年計畫 ^plan1` | `- [ ] 新年計畫 📅 2027-01-08 ^plan1` |
| 2027-W02 | `- [ ] 新年計畫 ^plan1 ` (one trailing space) | `- [ ] 新年計畫 📅 2027-01-15 ^plan1 ` |

#### Scenario: No unscheduled tasks

- **GIVEN** a project whose note has no unscheduled task
- **WHEN** the user expands the unscheduled list
- **THEN** the popover MUST show `這則筆記沒有還沒排日期的任務`

---
### Requirement: Adding a new task to the week

The popover footer SHALL offer `＋ 新增任務`. Activating it SHALL show a text input with the placeholder `輸入任務，Enter 加入，Esc 取消`. Pressing Enter SHALL insert the line `- [ ] <text> 📅 <schedule date>` into the note, where `<text>` is the input with line breaks and runs of whitespace collapsed to single spaces and trimmed, and the schedule date follows the scheduling requirement. When `<text>` already contains `📅 YYYY-MM-DD`, no date SHALL be appended. The new line SHALL be inserted directly after the last checkbox task line of the note (lines in code fences and frontmatter do not count); when the note has no checkbox task line, it SHALL become the last line of the note, keeping the note's trailing line terminator if it had one. An empty or whitespace-only input SHALL NOT write anything. Pressing Escape in the input SHALL close the input only and keep the popover open. After a successful add the input SHALL stay open, empty, and focused, so several tasks can be added in a row.

#### Scenario: New task lands after the last task line

- **GIVEN** a note whose lines are `## 拍攝`, `- [ ] 確認拍攝服裝 📅 2026-10-30`, `- [x] 租借場地 ✅ 2026-10-26`, empty line, `## 備註`
- **WHEN** the user types `寄出 邀請函` in the popover of `2026-W45` and presses Enter
- **THEN** the note MUST contain `- [ ] 寄出 邀請函 📅 2026-11-06` as the line directly after `- [x] 租借場地 ✅ 2026-10-26`
- **AND** `## 備註` MUST still follow the empty line

##### Example: end-of-note insertion (week 2026-W45, text `寄出 邀請函`)

| Content before (escaped) | Content after (escaped) |
| ------------------------ | ----------------------- |
| `## 備註\n` | `## 備註\n- [ ] 寄出 邀請函 📅 2026-11-06\n` |
| `## 備註` | `## 備註\n- [ ] 寄出 邀請函 📅 2026-11-06` |
| `` (empty note) | `- [ ] 寄出 邀請函 📅 2026-11-06` |
| `- [ ] A\n```md\n- [ ] 範例\n```\n` | `- [ ] A\n- [ ] 寄出 邀請函 📅 2026-11-06\n```md\n- [ ] 範例\n```\n` |

#### Scenario: Several tasks in a row

- **GIVEN** the new-task input is open and focused in the popover of `2026-W45`
- **WHEN** the user types `寄出 邀請函`, presses Enter, and the note change re-renders the dashboard
- **THEN** the re-opened popover MUST show the new-task input open, empty, and focused

#### Scenario: Enter that confirms an input-method composition does not submit

- **GIVEN** the user is composing Chinese text in the new-task input with an input method
- **WHEN** the user presses Enter to confirm the composition
- **THEN** the note MUST NOT be written and the composed text MUST stay in the input

#### Scenario: Empty input writes nothing

- **WHEN** the user presses Enter with an input of three spaces
- **THEN** the note MUST NOT be written

---
### Requirement: Jumping to the task line

Clicking `↗` SHALL open the row's note in the dashboard's note split, using the same reuse rule as clicking a project name, select the whole task line, scroll it into view, and close the popover. When the line cannot be located in the current note content by the task writer's locating rule, the note SHALL still open and the dashboard SHALL show the message `找不到那一行，可能剛被改過`.

#### Scenario: Jump selects the line

- **GIVEN** the row `確認拍攝服裝` whose task line is line 12 of its note
- **WHEN** the user clicks `↗`
- **THEN** the note MUST open to the right of the dashboard with line 12 selected and visible
- **AND** the popover MUST close

---
### Requirement: Opening the project note from the popover header

The project name in the popover header SHALL be clickable and SHALL open that project's note in the dashboard's note split, using the same reuse rule as clicking a project name in the project column. The popover SHALL stay open and SHALL be re-positioned against its anchor after the note opens; when the anchor cell is no longer visible within the dashboard pane, the popover SHALL close.

#### Scenario: Header name opens the note beside the dashboard

- **GIVEN** the popover for `範例專案 A` and `2026-W44` is open and no note split is open
- **WHEN** the user clicks `範例專案 A` in the popover header
- **THEN** that project's note MUST open to the right of the dashboard
- **AND** the popover MUST remain open next to its cell if that cell is still visible

---
### Requirement: All note writes go through one writer that verifies the line first

Every popover action that changes a note SHALL go through a single task writer that reads, modifies, and saves the note atomically. For an edit of an existing line, the writer SHALL locate the target line in the current content: the line at the recorded index when its text equals the recorded `raw`; otherwise the only line whose text equals `raw`; otherwise the edit SHALL be rejected as stale. The writer SHALL re-check the action's precondition against the located line's current text (toggle: checkbox and not recurring; shift: open checkbox with a `📅` date; schedule: open checkbox without any date-like marker, by the same rule as unscheduled tasks), judging the line in the context of the whole current note so that code-fence and frontmatter lines are never treated as checkbox tasks, and reject the edit as invalid when it fails. A rejected edit SHALL leave the note byte-for-byte unchanged.

The writer SHALL split the note into lines exactly as the scanner does (at `\r\n`, `\r`, or `\n`) so recorded line indices match. A successful edit SHALL change only the target line (or insert only the new line), SHALL keep every existing line's own terminator, SHALL give an inserted line the terminator of the line before it (or the note's first terminator, else `\n`), and SHALL preserve the presence or absence of a trailing line terminator.

When an edit is stale or invalid, the dashboard SHALL show the message `這一行在筆記裡剛被改過，畫面已更新，請再試一次`, re-scan immediately, and re-render. When the note no longer exists, the dashboard SHALL show `找不到這則筆記` and write nothing. A successful edit SHALL show no message; the re-rendered popover is the feedback.

#### Scenario: Line changed since the scan

- **GIVEN** the popover lists `確認拍攝服裝` from line 12 with raw `- [ ] 確認拍攝服裝 📅 2026-10-30`
- **AND** the user has since edited line 12 in the note to `- [ ] 確認拍攝服裝與髮型 📅 2026-10-30`
- **WHEN** the user clicks `▶` on that row
- **THEN** the note MUST NOT change
- **AND** the message `這一行在筆記裡剛被改過，畫面已更新，請再試一次` MUST appear

#### Scenario: Line moved down but unique

- **GIVEN** the popover lists a task recorded at line 12
- **AND** the user has since inserted two lines above it, so the identical text is now at line 14 and nowhere else
- **WHEN** the user clicks its checkbox
- **THEN** line 14 MUST be rewritten and no other line MUST change

#### Scenario: Ambiguous duplicate is rejected

- **GIVEN** the recorded line 12 no longer matches and two other lines both equal the recorded raw text
- **WHEN** the user clicks `▶` on that row
- **THEN** the note MUST NOT change

##### Example: line terminators preserved

| Content before (escaped) | Edit | Content after (escaped) |
| ------------------------ | ---- | ----------------------- |
| `- [ ] A 📅 2026-10-30\r\n- [ ] B\r\n` | toggle line 0 (today 2026-10-28) | `- [x] A 📅 2026-10-30 ✅ 2026-10-28\r\n- [ ] B\r\n` |
| `- [ ] A 📅 2026-10-30` | shift line 0 by +7 | `- [ ] A 📅 2026-11-06` |
| `## h\r\n- [ ] A 📅 2026-10-30\n- [ ] B 📅 2026-10-31\n` | shift line 1 by +7 | `## h\r\n- [ ] A 📅 2026-11-06\n- [ ] B 📅 2026-10-31\n` |
| `## h\n- [ ] A\r\n- [ ] B\n` | add `new` for 2026-W45 | `## h\n- [ ] A\r\n- [ ] B\n- [ ] new 📅 2026-11-06\n` |
