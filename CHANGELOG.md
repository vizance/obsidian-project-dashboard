# Changelog

## 0.2.0 — 2026-10-26

Edit tasks from the week popover. Clicking a week cell in the per-week view now opens a task list for that week: tick a task done or undo it, move it a week earlier or later with `◀` / `▶`, put one of the note's undated tasks into the week, add a new task, or jump to the task's line with `↗`. Clicking the project name at the top of the popover opens the note beside the dashboard. Empty dashed weeks and the dashed bar of a project without task dates open it too, so you can schedule the first task of an empty week. Changes are written into the project note in the Tasks plugin's emoji format; scheduled and new tasks get that week's Friday. Before saving, the dashboard checks that the line still matches what it last read, and asks you to try again if the note changed in between, so it never overwrites what you just typed. The popover stays open across the automatic refresh that follows each edit, and the new-task input stays open so several tasks can be added in a row. Lines inside code blocks or the frontmatter are never edited.

Fixed: a task line was counted as done whenever it contained a `✅` anywhere, so a task that merely linked to a finished note (`[[✅ …]]`) made its week look settled. A task now counts as done only when its checkbox is ticked or it carries a `✅` followed by a date, which is the marker the Tasks plugin writes.

Fixed: the week popover was cut off while the left sidebar was open, and cells near the right edge seemed to do nothing while a note was open in a split, because the popover was clipped inside the dashboard tab. It now floats above the whole window and stays inside the dashboard pane whenever it fits.

在週浮窗裡編輯任務。逐週模式下點週格子，會打開那一週的任務清單：可以勾完成或取消、用 `◀` `▶` 把任務移到前一週或下一週、把筆記裡還沒排日期的任務排進這週、新增任務，或按 `↗` 跳到筆記那一行。點浮窗最上方的專案名稱，會在儀表板右側打開這則筆記。空的虛線週與沒有任務日期的整條虛線也能點，所以可以把第一個任務排進空的那週。改動直接寫回專案筆記，用 Tasks 外掛的 emoji 格式；排進某週與新增的任務寫那週的星期五。寫入前會確認那一行跟儀表板上次讀到的一樣，筆記剛好被改過就不寫，請你再按一次，所以不會蓋掉你剛打的字。每次改完畫面自動更新時，浮窗會留在原本那一週，新增任務的輸入框也會保持開著，可以連續新增。程式碼區塊與 frontmatter 裡的行不會被修改。

修正：原本只要任務那一行出現 `✅` 就算完成，所以任務文字裡連到已完成筆記的 `[[✅ …]]`，會讓那一週被畫成已完成。現在要核取方塊打勾，或 `✅` 後面接日期（Tasks 外掛寫入的完成標記）才算完成。

修正：左側邊欄打開時，週浮窗會被切掉；右側開著筆記時，點靠右的格子像是沒反應。原因是浮窗被限制在儀表板分頁裡面。現在浮窗浮在整個視窗上方，放得下時會留在儀表板範圍內。

## 0.1.0 — 2026-10-25

First public version. Project Dashboard renders a year-at-a-glance Gantt chart of project notes as an Obsidian plugin tab: scans a configured project folder, derives each project's status, category, and date range from its filename, frontmatter, and task dates, and keeps the chart in sync as notes change.
