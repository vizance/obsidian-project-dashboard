## ADDED Requirements

### Requirement: Phone layout is chosen by Obsidian's phone check

When a dashboard tab opens, the dashboard SHALL read Obsidian's `Platform.isPhone` once. When it is true, the tab SHALL show the phone month view described in this capability; otherwise the tab SHALL show the year view or the month view exactly as before. The choice SHALL NOT change while the tab stays open — rotating the device, resizing the window, or narrowing the pane never switches layouts — and it SHALL be made again only when a dashboard tab opens. The width of the window or pane SHALL NOT be used to choose the layout.

On a phone, the dashboard tab SHALL NOT show the header (the `專案總覽` title, the project counts, and the legend), `顯示已結案`, `編輯分類與狀態`, the `年` / `月` switch, the `⚠` markers, the help-fab, or the help-panel, and it SHALL NOT render the year view or the Timeline view-mode. On a phone the keyboard shortcuts `M`, `T`, and `?` SHALL do nothing, including from an external keyboard, and the dashboard SHALL NOT write `dashboard.scale`, `dashboard.viewMode`, or `dashboard.projColWidth`. When the project folder is missing or holds no shown project, the phone layout SHALL show the same message text that the desktop dashboard shows in that case, for example `找不到專案資料夾：<folder>`.

#### Scenario: A phone gets the month view

- **GIVEN** Obsidian reports `Platform.isPhone` as true
- **WHEN** the user opens the dashboard
- **THEN** the tab MUST show the month view table
- **AND** it MUST NOT show the `年` / `月` switch, the legend, or the `?` help button

#### Scenario: A tablet keeps the year and month views

- **GIVEN** Obsidian reports `Platform.isPhone` as false and `Platform.isTablet` as true
- **WHEN** the user opens the dashboard
- **THEN** the tab MUST show the year view or the month view with the same controls as on a computer

#### Scenario: A narrow desktop pane keeps the desktop layout

- **GIVEN** Obsidian reports `Platform.isPhone` as false
- **WHEN** the user narrows the dashboard pane to 380 pixels wide
- **THEN** the tab MUST keep the controls, the legend, and the `?` help button of the computer layout

#### Scenario: Shortcuts do nothing on a phone

- **GIVEN** the phone month view is shown
- **WHEN** the user presses `M` on an external keyboard
- **THEN** the month view table MUST stay shown
- **AND** `dashboard.scale` MUST NOT be written

---
### Requirement: The phone shows the month view with a fixed project column

On a phone the dashboard tab SHALL show, from top to bottom, a controls row and the month view table.

The controls row SHALL hold `顯示暫停（<n>）` and the month navigation `◀`, the month title, `▶`, and `本月`. `顯示暫停（<n>）` SHALL follow the same rules as on a computer: it appears only when `<n>` is greater than 0, it counts the same projects, and it is unchecked whenever the dashboard tab opens. The month navigation SHALL behave as on a computer: `◀` and `▶` show the previous and the next month, the month title reads like `2026 年 11 月（W45–W49）`, and `本月` appears only when the shown month is not the month of today's week and brings that month back. When a dashboard tab opens on a phone, it SHALL show the month of today's week, whatever `dashboard.scale` holds.

The table SHALL be the same month view as on a computer, drawn by the same code: the same weeks of the shown month, the same project rows in the same order, the same cell colors, the same task text in each cell (a done task grey with `✓`, an open task red once its week has passed), the same mark on today's week, and the same `還沒排` counts. It SHALL differ from the computer in these ways only:

- There is no General row, whatever `calendars` holds.
- Closed projects (done or cancelled) are never shown. Paused projects are shown only while `顯示暫停（<n>）` is checked.
- The project column shows the category color dot, the project name, and `⏳ 暫停` for a paused project, but no `⚠` and no category or status menu.
- The project column is 96 CSS pixels wide and has no resize handle; the width saved in `dashboard.projColWidth` is not used.
- Each week column is at least 120 CSS pixels wide, and the `還沒排` column is 48 CSS pixels wide.

When the table area is wider than the sum of these widths, the week columns SHALL share the extra width equally. When it is narrower, the table SHALL scroll sideways inside the dashboard while the project column and its header stay fixed at the left edge; the dashboard tab itself SHALL NOT scroll sideways. Project names, task text, and the week headings SHALL wrap onto more lines when needed and SHALL NOT be cut off or overlap the next column.

#### Scenario: A phone held upright shows two weeks at a time

- **GIVEN** today is 2026-11-20, the phone shows November 2026 (W45–W49), and the table area is 390 CSS pixels wide
- **WHEN** the user opens the dashboard
- **THEN** the project column and the W45 and W46 columns MUST be fully visible without scrolling
- **AND** after the user swipes the table to the left, W49 and `還沒排` MUST become visible while the project names stay in place at the left edge

#### Scenario: A phone held sideways shows the whole month

- **GIVEN** the phone shows November 2026 (W45–W49) and the table area is 800 CSS pixels wide
- **WHEN** the user opens the dashboard
- **THEN** all five week columns and the `還沒排` column MUST be visible without scrolling
- **AND** the week columns MUST all have the same width

#### Scenario: The phone always opens on this month

- **GIVEN** `dashboard.scale` holds `year` and today is 2026-11-20
- **WHEN** the user opens the dashboard on a phone
- **THEN** the month title MUST read `2026 年 11 月（W45–W49）`
- **AND** `本月` MUST NOT be shown

#### Scenario: Changing the month on a phone

- **GIVEN** the phone shows November 2026
- **WHEN** the user presses `▶`
- **THEN** the month title MUST read `2026 年 12 月（W50–W53）`
- **AND** `本月` MUST be shown, and pressing it MUST show November 2026 again

#### Scenario: A closed project never shows on a phone

- **GIVEN** the done project `✅ 範例專案 C` has a task in W47
- **WHEN** the user opens the dashboard on a phone
- **THEN** no row for `範例專案 C` MUST be shown
- **AND** `顯示已結案` MUST NOT be shown

---
### Requirement: Month cells are edited from a phone the same way as on a computer

On a phone, tapping a week cell that is not blank SHALL open the week-popover for that project and week, and tapping a `還沒排` count greater than 0 SHALL open the unscheduled-popover for that project. Both popovers SHALL have the same content, actions, write rules, and messages as on a computer: ticking and unticking a task, `◀` and `▶` moving an open dated task one week, `＋ 從還沒排日期的任務挑一個`, `＋ 新增任務`, and the week buttons of the unscheduled-popover. When a write fails, the dashboard SHALL show the same message as on a computer and leave the note unchanged: `找不到這則筆記`, `這一行在筆記裡剛被改過，畫面已更新，請再試一次` (after which the dashboard re-scans), or `寫入筆記失敗，請再試一次`. After a successful write the table SHALL be drawn again and the popover SHALL stay open on the same project and week, as on a computer. Tapping a blank cell, a `還沒排` cell without a count, or the table heading SHALL NOT open a popover. Tapping outside an open popover SHALL close it.

On a phone each popover SHALL fit inside the screen: it SHALL be at most the screen width minus 16 CSS pixels wide, its left edge SHALL be at least 8 CSS pixels from the left of the screen, and its right edge SHALL be at least 8 CSS pixels from the right of the screen. When the screen size changes while a popover is open on a phone, for example when the user turns the phone, the popover SHALL stay open and SHALL be placed again by the same rules, so that it still fits inside the screen. Every checkbox and button inside a popover on a phone — including `◀`, `▶`, `↗`, the week buttons, the project name in the title, `＋ 從還沒排日期的任務挑一個`, and `＋ 新增任務` — SHALL have a tap area at least 44 × 44 CSS pixels. On a computer and on a tablet the popovers SHALL keep their current size and spacing.

#### Scenario: Ticking a task from a phone

- **GIVEN** today is 2026-11-20 and the active project `範例專案 A` has `- [ ] 準備讀書會 📅 2026-11-20`
- **WHEN** the user taps the W47 cell of `範例專案 A` and ticks `準備讀書會` in the popover
- **THEN** the note line MUST become `- [x] 準備讀書會 📅 2026-11-20 ✅ 2026-11-20`
- **AND** the W47 cell MUST show `✓ 準備讀書會` in grey
- **AND** the popover MUST stay open on `範例專案 A` and W47

#### Scenario: Moving a task one week later from a phone

- **GIVEN** today is 2026-11-20 and `範例專案 A` has `- [ ] 準備讀書會 📅 2026-11-20`
- **WHEN** the user taps the W47 cell of `範例專案 A` and presses `▶` beside `準備讀書會`
- **THEN** the note line MUST become `- [ ] 準備讀書會 📅 2026-11-27`
- **AND** `準備讀書會` MUST appear in the W48 cell of `範例專案 A`

#### Scenario: Scheduling an undated task from a phone

- **GIVEN** `Which day to write` is Friday and `範例專案 A` has the undated open task `- [ ] 寄出邀請` and no other undated task
- **WHEN** the user taps the `還沒排` count `1` of `範例專案 A` and presses `W48`
- **THEN** the note line MUST become `- [ ] 寄出邀請 📅 2026-11-27`

#### Scenario: A popover fits a phone screen

- **GIVEN** the screen is 390 CSS pixels wide
- **WHEN** the user taps a cell in the right-most column that is visible
- **THEN** the popover's left edge MUST be at least 8 CSS pixels from the left of the screen
- **AND** its right edge MUST be at most 382 CSS pixels from the left of the screen

#### Scenario: Turning the phone keeps the popover on the screen

- **GIVEN** the phone is held sideways with a screen 800 CSS pixels wide, and the popover of a cell at the right edge is open
- **WHEN** the user turns the phone upright, so the screen becomes 390 CSS pixels wide
- **THEN** the popover MUST stay open
- **AND** its left edge MUST be at least 8 CSS pixels from the left of the screen and its right edge at most 382 CSS pixels from the left of the screen

#### Scenario: Week buttons are easy to tap on a phone

- **GIVEN** the unscheduled-popover of `範例專案 A` is open on a phone
- **WHEN** the user looks at the week buttons such as `W48`
- **THEN** each week button MUST be at least 44 CSS pixels wide and 44 CSS pixels tall

#### Scenario: A changed line is not overwritten from a phone

- **GIVEN** the popover of `範例專案 A` W47 lists `準備讀書會` and that line was edited in the note after the last scan
- **WHEN** the user presses `▶` beside `準備讀書會`
- **THEN** the note MUST stay unchanged
- **AND** the message `這一行在筆記裡剛被改過，畫面已更新，請再試一次` MUST be shown

---
### Requirement: A project note opens in the dashboard's tab on a phone

On a phone, tapping a project name in the project column, tapping the project name in a popover's title, and tapping `↗` beside a task SHALL close any open popover and open that project's note in the dashboard's own tab, so that Obsidian's back control returns to the dashboard. `↗` SHALL also select that task's line in the note, as it does on a computer; when that line cannot be found, the dashboard SHALL show `找不到那一行，可能剛被改過`, as on a computer. When the note no longer exists, the dashboard SHALL stay shown with the message `找不到這則筆記`. On a computer or tablet, all three SHALL keep opening the note in the split to the right, reusing that split, as before.

#### Scenario: Opening a note and going back

- **GIVEN** the phone month view shows the row `範例專案 A`
- **WHEN** the user taps `範例專案 A` in the project column
- **THEN** the note of `範例專案 A` MUST open in the dashboard's tab
- **AND** no split MUST be created
- **AND** pressing Obsidian's back control MUST show the dashboard again

#### Scenario: Jumping to a task line on a phone

- **GIVEN** the popover of `範例專案 A` W47 lists `準備讀書會`
- **WHEN** the user taps `↗` beside `準備讀書會`
- **THEN** the popover MUST close
- **AND** the note of `範例專案 A` MUST open in the dashboard's tab with the line of `準備讀書會` selected

---
### Requirement: Calendars are not set up or read on a phone

On a phone, the plugin SHALL NOT call Obsidian's secret storage, SHALL NOT read any calendar, and SHALL NOT show any calendar event; the month view SHALL have no General row. The Calendars section of the settings tab SHALL show its heading and the single sentence `Calendar events show on a computer or tablet. Add your calendars there.`, with no name field, link field, color picker, delete button, or `Add a calendar` button. Saving any other setting on a phone SHALL keep the `calendars` list in plugin data unchanged.

#### Scenario: Settings on a phone

- **GIVEN** plugin data has one calendar named `工作` with a secret ID
- **WHEN** the user opens Settings → Project Dashboard on a phone
- **THEN** the Calendars section MUST show only its heading and `Calendar events show on a computer or tablet. Add your calendars there.`
- **AND** no call to Obsidian's secret storage MUST be made

#### Scenario: Other settings keep the calendars

- **GIVEN** plugin data has one calendar named `工作` with a secret ID
- **WHEN** the user changes `Project folder` on a phone
- **THEN** the saved plugin data MUST still have the calendar `工作` with the same secret ID and color

#### Scenario: No General row on a phone

- **GIVEN** plugin data has one calendar named `工作` with a secret ID
- **WHEN** the user opens the dashboard on a phone
- **THEN** the month view table MUST NOT have a General row
