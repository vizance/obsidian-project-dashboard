# Project Dashboard details

[Back to the tutorial](../README.md) · [繁體中文細節](details.zh-TW.md)

## Note names and dates

The dashboard reads Markdown notes directly inside `Project folder`, which defaults to `Projects`. It does not read subfolders. It skips a note when its name contains any text from `Projects to skip`. If the folder is missing, the dashboard says `找不到專案資料夾：<folder>` (project folder not found). If one note cannot be read, it skips that note and shows the others.

A useful filename is `🚧 P-20261102 範例專案.md`. The `P-` prefix is optional. The status symbol is looked for among the filename's first three Unicode characters:

| Symbol | Dashboard label | Meaning |
| --- | --- | --- |
| `🚧` or no symbol | `🚧 進行中` | Active |
| `⏳` | `⏳ 暫停` | Paused |
| `✅` | `✅ 完成` | Done |
| `❌` | `❌ 取消` | Cancelled |

The date properties at the top of a note use these exact names:

| Property | Use |
| --- | --- |
| `開始日期` | Project start date |
| `預計結束日期` | Expected end date; first choice for the end |
| `實際結束日期` | End date when no expected end can be read |

Use `YYYY-MM-DD`. A missing start or end can be taken from dates in the filename. For example, `P-20261102 ~ 1218 範例專案` gives a start of `2026-11-02` and end of `2026-12-18`; the end can also be written as eight digits, such as `20261218`. With just one eight-digit date, the filename supplies that date for both ends. Frontmatter dates win over filename dates.

If the end is still missing and the start is no later than December 31 of today's year, the end defaults to that December 31. It does not change when you look at a different year. There is no default start. Normal project rows need both dates.

Hover over `⚠` beside a project name to read its warnings, such as `起日由檔名推得` (start from filename), `迄日由檔名推得` (end from filename), `迄日預設為 <year>-12-31` (default end), `缺開始日期` (missing start), or `缺預計結束日期` (missing end).

Distant dates, such as an end in 9999, must not hold up the other rows. If drawing one row fails, only that row has empty week cells and `⚠`, with the tooltip `這個專案的日期有問題` (this project's dates have a problem). Other rows still appear.

## Task dates

A task date is `📅` or `✅`, followed by whitespace and `YYYY-MM-DD`. `📅` means planned and `✅` means completed. Plain dates, slash dates, and `due: 2026-11-20` do not count. All matching dates on a line count, including both the planned date and completion date.

- A task is done when its checkbox is `[x]` or `[X]`, or it has a `✅ YYYY-MM-DD` marker. All dates on that task inherit its done state.
- A `✅` inside a link such as `[[✅ P-2026 範例專案]]` does not mark the task done.
- Dates belong to ISO weeks, Monday through Sunday. Friday always stays in its own week.
- `Saturday tasks count for next week` is off by default. When on, a Saturday task belongs to the following Monday's week. It does not shift Sunday tasks or calendar events.

| Task date | Saturday setting off | Saturday setting on |
| --- | --- | --- |
| `2026-10-30` (Friday) | `2026-W44` | `2026-W44` |
| `2026-10-31` (Saturday) | `2026-W44` | `2026-W45` |
| `2026-11-01` (Sunday) | `2026-W44` | `2026-W44` |
| `2027-01-02` (Saturday) | `2026-W53` | `2027-W01` |

These task dates set which weeks have work. They never rewrite the project's expected end. A dated task stays visible before the start and after the end, while its project is shown. A task with dates in different weeks can appear in each of those weeks, once per week.

## Year view

The year view opens on today's local calendar year. It has every ISO week whose Thursday falls in the shown year: 53 weeks in 2026 and 52 in 2027. Today's week has a light red column only when it belongs to the shown year.

Use `◀` and `▶` beside the year title to step by one year. `今年` (this year) appears only in another year and returns to this year. Only the year/month choice is remembered, not the year you were looking at.

In the per-week view, each cell is decided on its own:

| Tasks in the week? | Project and week | Cell |
| --- | --- | --- |
| Yes | Active or paused; the week's Monday is on or after the end date | Red overflow block |
| Yes | Active or paused; any other week, including before the start | Category color; pale with `✓` if all tasks are done |
| Yes | Done or cancelled | Filled block with the closed grey style |
| No | Active or paused; week overlaps the project period | Dashed border |
| No | Any other case | Blank |

The project period includes the start and excludes the end: a week overlaps it when that Monday–Sunday week touches the period before the end. Red depends on the week's Monday, so a task just after the expected end but in that same week may still have the category color. Red takes priority over the pale done style.

For example, an expected end of `2026-11-06` and a task dated `2026-12-05` still show that task. With the Saturday setting on, it appears in `2026-W50` as red, opens in the popover, and is listed in December's month view. Empty weeks between the end and that task stay blank. Tasks before the start also appear. A closed project's tasks after its end appear as grey blocks when `顯示已結案` (show closed) is checked.

An active or paused project with no task dates has one long dashed span over its project period in the year view. Clicking it picks the week under the pointer. In the month view it becomes separate dashed cells.

Press `T` to switch to **Timeline**. This shows one continuous bar in the category color. It runs from the earlier of the start week and first task week to the later of the end week and last task week, clipped to the shown year. There are no idle gaps or red overflow parts. Closed bars stay grey. Clicking a Timeline bar opens its text only, with no edit controls. `T` has no effect in the month view and does not re-read notes or calendars.

## Week popover and editing

Click a solid, pale, red, or dashed week cell to open its editable popover. A blank cell does nothing. The header shows the project name, week number, and Monday–Sunday dates. An overflow week also says `⚠ 已超出預計結束日期 <end>` (past the expected end). An empty week says `這週還沒有任務` (no tasks this week yet).

The list includes each line with a date mapped to that week, once per source line. Lines are ordered by the earliest date on the line that belongs to the week, then by note order. The month view uses the same list and order. Display text omits the bullet, checkbox, and date markers, cuts the part starting with ` > `, and folds extra spaces.

Open tasks show their planned date. Done tasks show `已完成` (done) and their completion date when there is one. A Saturday mapped from the previous week says `預排在上週六，算進本週` for an open task, or `上週六完成，算進本週` for a done task.

### Editing actions

- **Tick or untick:** ticking changes the box to `[x]` and adds `✅ <today>` when there is no completion marker. Unticking changes it to `[ ]` and removes completion-date markers. Today is the device's local date.
- **Move a week:** `◀` and `▶` shift the first `📅` date by seven days. The weekday stays the same. These buttons are shown for open checkbox tasks with a planned date.
- **Pick an undated task:** `＋ 從還沒排日期的任務挑一個（N）` lists open undated tasks in note order. Picking one adds a planned date. If none remain, it says `這則筆記沒有還沒排日期的任務`.
- **Add a task:** `＋ 新增任務` opens an input. Enter adds `- [ ] <text> 📅 <date>` after the note's last checkbox task, or at the end when there is none. Empty input does nothing. Extra spaces and line breaks are folded; an already supplied `📅 YYYY-MM-DD` is kept. Enter used to finish Chinese input does not submit. After adding, the input stays open and empty for the next task. Escape in that input closes only the input.
- **Jump to a line:** `↗` opens the note on the right, selects the line, and closes the popover. If the line is no longer found, the note still opens with `找不到那一行，可能剛被改過`.
- **Open the note:** clicking the header's project name uses the same right-hand pane. The popover stays if its cell is still visible.

New and picked tasks use the weekday in `Which day to write`, Friday by default. If you choose Saturday and turn on the Saturday setting, the date written is the Saturday **before** that week's Monday, so it still maps to the week you picked.

| Target week | Weekday choice | Saturday setting | Date written |
| --- | --- | --- | --- |
| `2026-W45` | Friday | Either | `2026-11-06` |
| `2026-W45` | Monday | Off | `2026-11-02` |
| `2026-W45` | Saturday | Off | `2026-11-07` |
| `2026-W45` | Saturday | On | `2026-10-31` |
| `2026-W45` | Sunday | On | `2026-11-08` |

### Editing limits and closing

Editable checkboxes use `-`, `*`, or `+`, followed by `[ ]`, `[x]`, or `[X]`. Other checkbox states and dated text without a checkbox are read-only. Frontmatter and fenced code examples are never edited. Recurring tasks marked `🔁` must be ticked in the note, where the Tasks plugin can make the next occurrence.

All edits use the Tasks emoji format, even if your Tasks plugin uses Dataview format or has completion dates off. Markers go before a trailing block reference such as `^plan1`. The rest of the line, line endings, and other note text are kept.

Before changing a line, the dashboard checks that it still matches what it read. It can find a uniquely matching line that moved. If the line changed or cannot be found without doubt, it writes nothing, refreshes, and says `這一行在筆記裡剛被改過，畫面已更新，請再試一次`. If the note is gone, it says `找不到這則筆記`. Controls are disabled while their edit is being saved.

Only one popover is open at a time. Click the same cell, click outside, press Escape outside a text-entry field, use `↗`, or scroll the chart to close it. Scrolling inside the popover or in another note pane does not close it. It fits within the dashboard pane when there is room, and otherwise within the window; long lists scroll inside it. Moving the dashboard to another window closes the old popover. You can then open it in that window as usual.

## Month view

Click `年` / `月`, or press `M`, to switch views. The month view has the same project rows, order, filters, category controls, and project column width as the year view. Week columns share the space, long text wraps, and rows grow to fit tasks.

A week belongs to the month of its **Monday**, with one exception: ISO week 1 always belongs to January, even when its Monday is in December. The year view's month and quarter headers use this rule too. October 2026 has W41–W44; November has W45–W49.

The title gives the year, month, and weeks, such as `2026 年 11 月（W45–W49）`. `◀` / `▶` step through months across year boundaries. `本月` (this month) appears only in another month and returns to the month of today's week.

Switching from this year's chart opens the month of today's week. Switching from another year opens January of that year. Switching back to the year view shows the month’s year. Opening a dashboard starts on this year or the month of today's week. Changing year, month, or view closes a popover. Automatic updates keep the period you are viewing.

Every dated task line appears in its mapped week, including before the project's start and after its expected end. Blank cells have no task text. Styles are:

- Grey with `✓`: done.
- Red text: open, and the task's week ended before today's week began.
- Normal text: open, with the week still current or ahead.

Text and background tell different facts. Red text means an unfinished task in a past week; a red cell background means work past the project's expected end. The background uses the same per-week rules as the year view. Clicking a non-blank project cell opens the full editable week popover, even when the year view was in Timeline mode.

## Unscheduled tasks

`還沒排` (not scheduled yet) counts open checkbox tasks with no dates. Done tasks, plain text, and custom checkbox states are not counted. A malformed or variant date marker is left for you to fix in the note, so it is not offered for a second date. A link containing `✅` without a date does not stop a task from being offered.

Click a count to see tasks in note order. Each task has one button per week of the shown month and a `↗` button to jump to its line. A week button works when that project's cell for the week is not blank. Otherwise it is greyed out with `不在專案期間` (outside project period). A week outside the project period can still be available when it already has a dated task. Scheduling uses the same date choice, saved format, and line checks as the week popover.

After scheduling, the list stays open with one fewer task. It closes when the last task is scheduled, the project becomes hidden, or you change the month or view. Empty count cells do nothing. The usual popover closing rules apply.

## General row and calendars

The month view shows `General` above all project rows once at least one calendar has a saved-link entry, even if no projects match. It disappears when none has been set up. A new empty calendar row is skipped without a request or error. A saved entry with no link on this computer shows an error instead.

The General row is read-only. Its week cells never open a popover; clicking them closes an open one. Its `還沒排` cell is always blank. Today's week is highlighted as in the other rows. The year view has no calendar events.

### Calendar links and labels

See the [tutorial's calendar setup](../README.md#general-row-calendars) for Google and iCloud steps. Links can let other people read a calendar. If a Google secret address leaks, reset it in that calendar's settings and paste the new one into the plugin; the old address stops working.

The plugin accepts trimmed links starting with `https://` or `webcal://`. A `webcal://` link is read over `https://`, with the rest unchanged. Links stay in Obsidian's secret storage, never in plugin data, local preferences, logs, notices, tooltips, or dashboard text. Each computer needs its own pasted link. Calendar names and colors can travel with the other settings through Obsidian Sync.

Each event begins with its calendar's name label. An unnamed calendar uses `行事曆 1`, `行事曆 2`, and so on, based on list position. The chosen color is used; without one, the list cycles through blue (`#4a7fd4`), green (`#2f9e6e`), orange (`#e08a2c`), purple (`#8e5bd6`), teal (`#1b9aaa`), and pink (`#d6559e`). Defaults avoid red, which marks overdue tasks and work beyond the expected end. Names and colors update after saving without reading calendars again.

### When calendars are read

There are exactly five triggers:

1. A dashboard tab opens.
2. You press `↻` in the General row.
3. You run `Project Dashboard: Refresh calendars`.
4. You paste a new link for a calendar that was already set up, keeping the same saved-link entry. It is read again right away.
5. The list or order of calendars with a saved-link entry changes, after settings save, after outside settings arrive, or after a failed save restores the last saved settings.

Renaming a calendar or changing its color does not start a read. There is no timer. Year/month navigation, `今年`, `本月`, switching views, and note edits do not start a read.

All open dashboards share the results. If another read is requested while one is running, one more read follows it with the settings then in effect. Refreshing keeps an open week popover in place when its cell remains available. Results live only in memory. Removing a calendar or changing its saved-link entry drops its old results at the next read; other calendars keep their own results. Unloading clears the results and ignores any late response or queued read.

### Events and dates

Dates and times use the device's local time. Time zones in the calendar and UTC times are converted; times without a known time zone are read as local. All-day dates stay as written. Times use the 24-hour clock.

| Event | Example text after the name label |
| --- | --- |
| Timed, same day | `11/6（五）13:30 讀書會` |
| All-day, one day | `11/11（三）休假` |
| All-day, several days | `11/7（六）–11/9（一）研習營` |
| Timed, ends on another day | `11/8（日）22:00–11/9（一）01:00 夜間維護` |

An event without a title reads `（沒有標題）`. An event appears in every week it touches. An end is exclusive: an event ending exactly at Monday 00:00 does not enter the week starting then. Without an end, a duration is used; without either, timed events end at their start and all-day events last one day. Saturday task settings never shift calendar events.

Repeating events are expanded into occurrences. Excluded dates, moved occurrences, and cancelled occurrences are respected; cancelled events are hidden. Occurrences with the same event identifier and start are shown once, even across calendars. Within a week, events sort by start date, then all-day before timed events on the same date, then start time, calendar order, and title.

### Status and errors

The status under `General` is blank before the first read in the session, `讀取中…` while reading, then `更新於 15:20` with the last finish time. Failures add `・⚠ 1 個行事曆讀不到`, with the count that failed. Hover for one `<name>：<reason>` per calendar:

| Reason | Meaning |
| --- | --- |
| `連結格式不對` | The stored link does not start with an accepted scheme |
| `這台裝置找不到連結` | This computer has no saved link for that calendar |
| `讀取失敗（HTTP 404）` | The server returned an error; the number is its actual status |
| `連不上` | The request failed, for example without an internet connection |
| `內容看不懂` | The response cannot be read as an iCalendar file |
| `行事曆太大` | The response is larger than 20 MB |

A failed calendar keeps its last successful events in this plugin session. If it has never succeeded, it shows none. Other calendars and all project rows still work. Repeating events have limits on both occurrences examined (100,000 per event) and candidate dates searched (200,000 per search), so malformed rules cannot hold up the dashboard.

See the README for [network use](../README.md#network-use) and [third-party code](../README.md#third-party-code).

## Phone month view

Obsidian decides whether the device is a phone when a dashboard tab opens. Phones get the month view. Computers and tablets keep the year and month views. Rotating the device, resizing a window, or narrowing a pane does not switch layouts while the tab stays open. The layout is checked again the next time a dashboard tab opens.

### Table and sideways scrolling

The phone uses the same month table as a computer: one row per project, one column per week, and task text in the cells. Weeks, project order, cell colors, task text and order, today's week mark, and `還沒排` counts follow the same rules. Done tasks are grey with `✓`. Open tasks in past weeks are red. See [month view](#month-view) and [task dates](#task-dates) for week and Saturday rules. Phones have no General row.

The name column is 96 pixels wide. Names and the column heading stay fixed on the left. Each week is at least 120 pixels wide. `還沒排` is 48 pixels wide. An upright phone shows about two weeks at once. Swipe the table left or right to see other weeks and `還沒排`; project names stay in place. The dashboard tab itself does not scroll sideways. Turn the phone sideways to see the whole month when there is enough room. Extra space is shared equally by the weeks. Long names, task text, and week headings wrap onto more lines.

### Month and projects

Each time the tab opens, it starts on the month of today's week. A title such as `2026 年 11 月（W45–W49）` shows the month and weeks. `◀` and `▶` go to the previous and next month. `本月` (this month) appears only in another month and brings back the month of today's week. This row holds only the month controls and `顯示暫停（n）` (show paused).

Projects use the dashboard's row order and filters. Notes outside the project folder or matching `Projects to skip` are skipped. A project needs both a start and an end date after the usual date fallbacks. Done and cancelled projects never appear on a phone. Paused projects appear only when `顯示暫停（n）` is checked. That control appears only when there are paused projects to show and starts unchecked each time the tab opens.

### Pop-ups and task edits

Tap a week cell with tasks or a dashed border to open the same week pop-up as on a computer. Tick or untick a task. Use `◀` and `▶` to move an open task one week. Use `＋ 從還沒排日期的任務挑一個` to pick an undated task, or `＋ 新增任務` to add one. Tap a `還沒排` number to open its pop-up, then use a week button beside a task to put it in that week. Blank cells, `還沒排` cells with no count, and table headings do not open a pop-up.

Dates written, editing limits such as recurring tasks, line checks before saving, and error messages follow the same rules as on a computer. See [week popover and editing](#week-popover-and-editing) and [unscheduled tasks](#unscheduled-tasks). New and picked tasks use Friday by default, set by `Which day to write`. After a saved edit, the table updates and the pop-up follows the computer's rules for staying on the same project and week. The undated-task pop-up closes after its last task is scheduled.

A phone pop-up stays at least 8 pixels from each side of the screen. Checkboxes and buttons have a tap area of at least 44 × 44 pixels. Tap outside the pop-up or swipe the table sideways to close it.

### Opening notes and going back

Tap a project name in the name column or a pop-up's title, or tap `↗` beside a task. The pop-up closes and the note opens in the dashboard's own tab. `↗` also selects the task's line. Use Obsidian's back control to return to the dashboard. It opens on the month of today's week again. Computers and tablets keep opening notes in the right-hand pane.

If the note is gone, the dashboard stays open and says `找不到這則筆記` (note not found). If the note opens but the task's line cannot be found, it says `找不到那一行，可能剛被改過` (line not found; it may have changed).

### Other phone controls and calendars

Phones have no `專案總覽` title, project counts, legend, year view, year/month switch, Timeline, `顯示已結案`, category or status editing, `⚠` date warnings, help panel, or `?` button. You cannot drag the legend or resize the name column. Keyboard shortcuts do nothing, even with an external keyboard. Missing folders and empty project lists use the same messages as on a computer, such as `找不到專案資料夾：<folder>`.

On a phone, the plugin reads no calendars, shows no calendar events, and makes no network requests, even with calendars already set up. `Project Dashboard: Refresh calendars` is absent from the command palette. In settings, `Calendars` shows only its heading and `Calendar events show on a computer or tablet. Add your calendars there.` There are no calendar fields or buttons. The plugin does not access secret storage on a phone. Saving other settings keeps the saved calendar list unchanged.

## Status and categories

Paused projects are hidden in both views at first. `顯示暫停（<n>）` (show paused) appears only when there are paused projects to show. It counts projects in the configured folder that are not skipped and have both dates. The count updates after each scan. Shown paused projects keep their usual order, a grey `⏳ 暫停` badge, and category-colored diagonal stripes at reduced opacity.

`顯示已結案` (show closed) controls done and cancelled projects together. Their blocks are grey at about 35% opacity. Both visibility checkboxes reset to unchecked when the dashboard opens.

`編輯分類與狀態` (edit category and status) shows category and status menus on every row, in either view. It starts unchecked each time the dashboard opens. Status choices are `🚧 進行中`, `⏳ 暫停`, `✅ 完成`, and `❌ 取消`.

Changing status replaces a symbol among the filename's first three characters and its following spaces with the new symbol and one space, or adds the prefix when there was no leading symbol. The rest of the name, its folder, and the manual category choice stay. Links in other notes follow Obsidian's **Automatically update internal links** setting. An existing target filename blocks the rename with `已經有同名的筆記，狀態沒有改`. If the new status is hidden by its checkbox, the row and its popover disappear after the scan.

Category choices apply to the exact full project name, with status symbols removed. They win over every name rule. Choose `自動（清除覆寫）` (automatic, clear manual choice) to return to the rules. A saved choice shows `已更新分類`; a failed save shows `分類儲存失敗，請再試一次` and restores the actual choice.

## Settings

Open **Settings → Project Dashboard**. Settings apply without a rebuild.

### Project notes

- `Project folder`: the folder path inside your vault, default `Projects`. Leading/trailing spaces and `/` are removed. Empty falls back to `Projects`. Missing folders show `Can't find this folder.` using that final value.

  Tap or click the box to see all folders, even when it already holds a path. The list leaves out the top level (`/`) and sorts paths in alphabetical order, ignoring case. Type or delete text to filter it. A path matches when it contains that text anywhere, ignoring case and spaces at the text's ends. Empty text shows all folders. Leave the box and tap or click it again to see all folders again.

  Pick a folder to fill in its path and close the list. It works just like typing the path: saves after a 400 ms pause, updates open dashboards, and updates the `Can't find this folder.` hint. You can still type a path yourself, even if it is not in the list. This works the same on computers, tablets, and phones. The field's help text includes: `Tap or click the box to pick a folder from a list.`
- `Projects to skip`: one filename fragment per line, default empty. Spaces at the ends and empty lines are ignored. Any matching fragment skips a project.

### Categories

Rules match words in the project name, top to bottom. **The first match wins.** Keep a longer phrase above one it contains, such as `企業內訓` above `內訓`. No match means `其他` (other). A manual choice wins over the rules.

Each rule has text, a category menu, `Move up`, `Move down`, and `Delete`. `Add a rule` adds an empty rule under `其他`. It survives saving and has no effect until text is entered. Removing all rules leaves all projects automatic under `其他`, unless manually assigned.

| Default rule, in order | Category |
| --- | --- |
| `企業內訓` | `企業內訓` |
| `內訓` | `企業內訓` |
| `線上課程` | `線上課程 / Cohort` |
| `課程` | `線上課程 / Cohort` |
| `出版` | `出版` |
| `教練` | `1-on-1 教練` |
| `諮詢` | `1-on-1 教練` |
| `業配` | `業配 / 合作` |
| `合作` | `業配 / 合作` |
| `生活` | `生活` |

The seven category labels and their chart colors are built in; the settings change matching rules, not those labels or colors.

### Dates

- `Which day to write`: Monday through Sunday, default Friday. Used when picking an undated task or adding a task into a week.
- `Saturday tasks count for next week`: default off. When on, Saturday task dates map to the following week. The special date written when Saturday is also selected is explained under [editing](#week-popover-and-editing).

### Calendars

`Add a calendar` adds one empty row. Each row has a name (`Calendar name`, Chinese allowed), a link field, a `Color` picker, and `Delete`.

The link field hides pasted text. Paste, Enter, or leaving the field checks it. A valid link is saved and the field clears; an invalid link is not saved, clears, and shows `This is not a calendar link. It should start with https:// or webcal://.` Empty input changes nothing. Stored links are never put back into the field.

| Field hint | Meaning |
| --- | --- |
| `Paste the calendar link here` | No link has been set yet |
| `Link saved. Paste a new link to change it.` | A link is saved on this computer |
| `This computer has no link yet. Paste it here.` | This calendar's link is missing on this computer |

`Delete` removes the row and clears the link saved by this plugin. Pasting or deleting never overwrites a secret belonging to another use. You do not need to choose a storage identifier.

## Help and layout

Click the bottom-right `?`, or press `?` or `/`, to open or close help. It opens automatically on the first visit and remembers whether you left it open.

There are three tabs. Each time help opens it selects the current view's tab. Click a tab or use the arrow keys while a tab is focused to switch:

- `年視圖`: each cell's meaning, items needing attention, whole-row status, and colors/columns. Samples include red overflow blocks, warnings, paused stripes, closed grey blocks, and today's column.
- `月視圖`: task text, cell backgrounds, General calendar name labels and refresh, and `還沒排` counts.
- `操作`: editing, switching views/periods, and layout actions.

The active tab has bold text and a colored underline. Long content scrolls inside the panel.

Projects sort by category priority, then by start date within each category. The default category order is corporate training, online course, coaching, publishing, sponsorship, life, and other. Click a legend item to bring that category to the top; click again to unpin. Drag legend items to change category priority. Only one category can be pinned at a time.

Drag the right edge of the project column to resize it. The default is 280 pixels, with a range of 120–600 pixels. The width is shared by the year and month views.

Shortcuts work only in the active dashboard tab. `T`, `M`, `?`, and `/` do nothing while an input, textarea, or menu has focus, or while Ctrl, Cmd, or Alt is held. Escape closes an open popover even after ticking a checkbox; it does not close it while you are typing in another text field. Escape in the new-task input closes only that input.

## Updates and saved choices

Project-note changes update an open dashboard after a 400 ms pause. Creating, deleting, renaming, or moving a Markdown note counts when its old or new location is directly in the project folder. Other notes and subfolders do not cause a scan. No open dashboard means no scan.

Updates preserve scrolling, filters, view, period, category order, pinned category, and column width. A popover reopens on the same project/week if that cell still allows it. Its expanded section stays open. Unsubmitted input stays; submitted input clears. Focus returns only if that input had focus before, so typing in a note does not move focus into the dashboard.

Clicking a project name opens its note in a pane to the right. Later clicks reuse that pane. If it has been closed, a new pane is made. Menus do not open notes. A dashboard left open at quit is restored with the workspace and freshly read notes.

Settings and manual category choices share `.obsidian/plugins/project-dashboard/data.json`. A settings edit saves 400 ms after the last change, then updates open dashboards. Each setting is checked on its own; one bad field does not erase the others. Changing a category keeps settings; changing settings keeps category choices. None of these user values is stored in this repository.

A failed settings save says `Your settings couldn't be saved. Please try again.` and restores the last saved values. Settings arriving from outside the running plugin, such as Obsidian Sync, replace local edits still waiting to save. Unloading saves any pending settings once, then stops saving.

The view choice, year-view mode, help state, category order, pinned category, and column width use Obsidian's local preferences for this vault. Failures there fall back to defaults without stopping the chart. The shown year/month and visibility/editing checkboxes are not remembered. Calendar links are kept separately in secret storage; fetched events are never saved.
