## ADDED Requirements

### Requirement: Quarters fold in the year view

In the year view, each quarter header SHALL hold a button that shows the quarter label followed by `▾` while the quarter is expanded, for example `Q4 ▾`, and by `▸` while it is folded, for example `Q1 ▸`. The button SHALL have the tooltip `折起這一季` while expanded and `展開這一季` while folded, and its `aria-expanded` SHALL match. Pressing the button SHALL fold an expanded quarter or expand a folded one. The month view and the phone layout SHALL NOT change.

A folded quarter SHALL be drawn as one column 40 CSS pixels wide in place of all its week columns. In the header, the quarter row SHALL show the quarter's button over that column, and one empty heading cell SHALL fill the month row and the week row beneath it. In every project row, the folded column SHALL be one empty cell with the panel background. A folded column SHALL show no bar, SHALL NOT carry `data-path` or `data-week`, and clicking it SHALL NOT open a popover. Expanded quarters SHALL be drawn as before: each week column 32 CSS pixels wide, with the same month and quarter dividers, the same bars, and the same today column.

A bar SHALL NOT extend over a folded column. In both `per-week` and `timeline` modes, the week cells SHALL be worked out separately for each run of consecutive expanded weeks, so that a multi-week bar that crosses a folded quarter is drawn as one bar on each side of the folded column and a bar whose weeks are all folded is not drawn. Clicking a week inside a multi-week dashed bar SHALL still open the popover of the week that was clicked.

When the year view shows the calendar year of today's local date and today's week is one of its week columns, every quarter before the quarter that holds today's week SHALL start folded and every other quarter SHALL start expanded. When the year view shows any other year, or today's week is not one of its week columns, every quarter SHALL start expanded.

The fold state SHALL stay as the user left it while the same year stays shown. This SHALL include drawing again after a note changes, after a settings change, after checking or unchecking `顯示已結案` or `顯示暫停（<n>）`, after pressing `T`, and after switching to the month view and back to the same year. The fold state SHALL go back to the starting state when the year view shows another year and when the dashboard tab opens. The fold state SHALL NOT be stored. Folding or expanding a quarter SHALL close any open popover and SHALL keep the chart's sideways scroll position as far as the new table width allows.

#### Scenario: Past quarters start folded

- **GIVEN** today is 2026-11-20, which is in 2026-W47 in Q4
- **WHEN** the user opens the year view of 2026
- **THEN** the quarter headers MUST read `Q1 ▸`, `Q2 ▸`, `Q3 ▸`, and `Q4 ▾`
- **AND** the week headers MUST be W40 through W53 only
- **AND** every project row MUST have three folded cells and no bar inside them

#### Scenario: Expanding and folding a quarter

- **GIVEN** today is 2026-11-20 and the year view of 2026 shows Q1, Q2, and Q3 folded
- **WHEN** the user presses `Q2 ▸`
- **THEN** the header MUST read `Q2 ▾` and the week headers W14 through W26 MUST be shown between the folded Q1 and the folded Q3
- **AND** pressing `Q2 ▾` MUST fold Q2 again

#### Scenario: The fold state survives drawing again

- **GIVEN** the user expanded Q1 in the year view of 2026
- **WHEN** a project note changes and the dashboard draws again
- **THEN** Q1 MUST still be expanded and Q2 and Q3 MUST still be folded

#### Scenario: Another year starts expanded

- **GIVEN** today is 2026-11-20 and the year view of 2026 shows Q1, Q2, and Q3 folded
- **WHEN** the user presses `▶`
- **THEN** the year view of 2027 MUST read `Q1 ▾`, `Q2 ▾`, `Q3 ▾`, and `Q4 ▾` with week headers W1 through W52 and no folded cell
- **AND** pressing `◀` MUST show 2026 with Q1, Q2, and Q3 folded again

#### Scenario: Nothing is folded in the first quarter

- **GIVEN** today is 2026-01-15, which is in Q1
- **WHEN** the user opens the year view of 2026
- **THEN** all four quarters MUST be expanded

#### Scenario: A bar stops at a folded quarter

- **GIVEN** today is 2026-11-20, the year view is in `timeline` mode, and a project runs from 2026-08-03 (W32) to 2026-11-30 (W49)
- **WHEN** the year view of 2026 shows Q3 folded
- **THEN** that project's row MUST have one timeline bar, starting at W40 and covering 10 weeks
- **AND** after the user expands Q3, the row MUST have one timeline bar starting at W32 and covering 18 weeks

---
### Requirement: The year view's 本週 button brings this week into view

In the year view, the place in the controls row that the month view uses for `本月` SHALL hold a button `本週` with the tooltip `捲到本週`. The year view SHALL NOT show `今年`. `本週` SHALL be shown only while one of these is true:

- The shown year is not the calendar year of today's local date.
- The shown year is that year, today's week is one of its week columns, and either the quarter that holds today's week is folded or today's week column is not fully inside the visible chart area to the right of the project column.

Whether `本週` is shown SHALL be checked again after the chart is drawn, when the chart scrolls sideways, when the window is resized, and after the project column is resized.

Pressing `本週` SHALL do these steps in order. When another year is shown, it SHALL show the calendar year of today's local date, with that year's starting fold state. When the quarter that holds today's week is folded, it SHALL expand that quarter. When today's week is one of the shown year's week columns, it SHALL scroll the chart sideways so that the center of today's week column is at the center of the visible chart area to the right of the project column, or as close to it as the scroll range allows. Afterwards `本週` SHALL be hidden whenever today's week column fits inside that area. When today's week is not one of the calendar year's week columns, for example on 2027-01-01, which belongs to 2026-W53, pressing `本週` SHALL show the calendar year and SHALL NOT scroll.

#### Scenario: 本週 is hidden while this week is in view

- **GIVEN** today is 2026-11-20 and the year view of 2026 is wide enough to show the W47 column with Q1, Q2, and Q3 folded
- **WHEN** the user opens the year view
- **THEN** `本週` MUST NOT be shown
- **AND** `今年` MUST NOT be shown

#### Scenario: Scrolling back to this week

- **GIVEN** today is 2026-11-20, every quarter of 2026 is expanded, and the chart is scrolled to its left edge so that W47 is outside the visible chart area
- **WHEN** the user presses `本週`
- **THEN** the center of the W47 column MUST be at the center of the visible chart area to the right of the project column, within 1 CSS pixel
- **AND** `本週` MUST be hidden

#### Scenario: 本週 from another year

- **GIVEN** today is 2026-11-20 and the year view shows 2027
- **WHEN** the user presses `本週`
- **THEN** the year view MUST show 2026 with Q1, Q2, and Q3 folded
- **AND** the W47 column MUST be fully inside the visible chart area

#### Scenario: 本週 when this week's quarter is folded

- **GIVEN** today is 2026-11-20 and the user folded Q4 in the year view of 2026
- **THEN** `本週` MUST be shown
- **WHEN** the user presses `本週`
- **THEN** Q4 MUST be expanded and the W47 column MUST be fully inside the visible chart area
