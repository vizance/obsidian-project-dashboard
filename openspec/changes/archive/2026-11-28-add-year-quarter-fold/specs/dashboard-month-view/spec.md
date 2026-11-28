## MODIFIED Requirements

### Requirement: Switching between the year view and the month view

The dashboard SHALL show a two-option switch `年` / `月` in its controls row, with the active option marked. Pressing `M` (case-insensitive) SHALL toggle between the two, under the same conditions as the `T` shortcut (ignored with a modifier key held, while a text-entry element has focus, or when the dashboard tab is not active). The chosen view SHALL be stored in vault-scoped local storage under `dashboard.scale` with the value `year` or `month`, and SHALL be restored when the tab opens; a missing or unknown value SHALL mean `year`.

When the month view is shown, the controls row SHALL also show `◀`, the month title, and `▶`, followed by `本月` only while the shown month is not the month that today's week belongs to. The title SHALL read `<year> 年 <month> 月（W<first week>–W<last week>）`, for example `2026 年 10 月（W41–W44）`. `◀` and `▶` SHALL show the previous and next month, crossing year boundaries; `本月` SHALL show the month that today's week belongs to. Week numbers in the title SHALL have no leading zero, matching the year view's week headers (`W1`, not `W01`).

When the year view is shown, the same place in the controls row SHALL show `◀` (tooltip `上一年`), the title `<year> 年`, for example `2026 年`, and `▶` (tooltip `下一年`), followed by `本週` (tooltip `捲到本週`) only under the conditions that `dashboard-year-quarter-fold` sets. `◀` and `▶` SHALL show the previous and next year; `本週` SHALL behave as `dashboard-year-quarter-fold` sets, which includes showing the calendar year of today's local date when another year is shown. The year view SHALL NOT show `今年`.

When the tab opens, the year view SHALL show the calendar year of today's local date and the month view SHALL show the month that today's week belongs to. Switching from the year view to the month view SHALL show the month that today's week belongs to when the year view showed the calendar year of today's local date, and January of the shown year otherwise. Switching from the month view to the year view SHALL show the year of the shown month. Neither the shown year nor the shown month SHALL be stored. Changing the shown year or month, or switching between the year view and the month view, SHALL close any open popover.

#### Scenario: Opening the month view shows the current month

- **GIVEN** today is `2026-10-30`, in `2026-W44`
- **WHEN** the user picks `月`
- **THEN** the month view MUST show `2026 年 10 月（W41–W44）`
- **AND** pressing `▶` MUST show `2026 年 11 月（W45–W49）`
- **AND** pressing `▶` twice more MUST show `2027 年 1 月（W1–W4）`
- **AND** pressing `本月` MUST show `2026 年 10 月（W41–W44）` again
- **AND** `本月` MUST NOT be shown while `2026 年 10 月（W41–W44）` is shown

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

#### Scenario: Moving to next year in the year view

- **GIVEN** today is `2026-11-20` and the year view shows `2026 年` without a `本週` button
- **WHEN** the user presses `▶`
- **THEN** the year view MUST show `2027 年` with week columns `W1` through `W52`
- **AND** `本週` MUST be shown, and pressing it MUST show `2026 年` again
- **AND** no week column MUST be highlighted as today while `2027 年` is shown

#### Scenario: Switching keeps the period being planned

- **GIVEN** today is `2026-11-20` and the year view shows `2027 年`
- **WHEN** the user picks `月`
- **THEN** the month view MUST show `2027 年 1 月（W1–W4）`
- **WHEN** the user presses `▶` twice and then picks `年`
- **THEN** the year view MUST show `2027 年`

#### Scenario: The current year still opens on this month

- **GIVEN** today is `2026-11-20` and the year view shows `2026 年`
- **WHEN** the user picks `月`
- **THEN** the month view MUST show `2026 年 11 月（W45–W49）`

#### Scenario: Restart returns to today

- **GIVEN** the year view shows `2027 年`
- **WHEN** the user relaunches Obsidian and opens the dashboard
- **THEN** the year view MUST show `2026 年`
