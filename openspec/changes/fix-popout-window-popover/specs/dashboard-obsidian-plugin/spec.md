## ADDED Requirements

### Requirement: Dashboard works the same in a pop-out window

The dashboard tab SHALL behave the same whether it is in Obsidian's main window or in a pop-out window, and after it is moved from one window to another. Every interaction SHALL listen to the window that currently contains the dashboard tab, not to the window that was active when the tab opened: opening the week popover from a year-view cell, a month-view cell, or a `還沒排` cell; closing it by clicking the same cell again, clicking outside it, pressing `Escape`, or scrolling an element that contains its anchor; reordering the category legend by dragging; resizing the project column by dragging; and the dashboard's keyboard shortcuts. The popover SHALL be shown in the window that contains the dashboard tab. When the dashboard tab is moved to another window, an open popover SHALL be closed, and every interaction SHALL work in the new window and SHALL NOT react to clicks or scrolls in the old window.

#### Scenario: Opening a popover in a pop-out window

- **GIVEN** the dashboard tab has been dragged out of the main window into a pop-out window and shows the year view
- **WHEN** the user clicks a solid week cell of `範例專案 A` in that window
- **THEN** the week popover for that project and week MUST appear in the pop-out window, anchored at the clicked cell
- **AND** clicking outside the popover in the pop-out window MUST close it

#### Scenario: Month view in a pop-out window

- **GIVEN** the dashboard tab is in a pop-out window and shows the month view
- **WHEN** the user clicks a non-blank month cell, and later a `還沒排` cell with a count
- **THEN** the week popover and then the unscheduled popover MUST appear in the pop-out window

#### Scenario: Moving the tab back to the main window

- **GIVEN** the dashboard tab is in a pop-out window with a week popover open
- **WHEN** the user moves the tab back into the main window
- **THEN** the popover MUST be closed
- **AND** clicking a week cell in the main window MUST open the popover there
- **AND** clicks in the closed or emptied pop-out window MUST NOT open or close any popover
