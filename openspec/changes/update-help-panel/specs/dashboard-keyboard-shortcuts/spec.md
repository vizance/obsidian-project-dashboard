## MODIFIED Requirements

### Requirement: Help panel content

The help panel SHALL display four sections, one short line per item, with the following content:

- **Shortcuts section**: lists at minimum `T` (切換週視圖 / Timeline，只作用在年視圖), `M` (切換年 / 月), and `?` (顯示 / 隱藏面板).
- **Visual legend section** (the year view), each item with a sample of the style:
  - Solid filled block in category color → 該週有任務排定（尚未完成）
  - Dimmed category-color block with a checkmark (✓) → 該週任務已全部完成（settled）
  - Dashed border block in category color → 該週無任務（仍在專案區間）
  - Solid filled block in warning red → 超出原訂結束日（scope creep）— 該回去更新 frontmatter `預計結束日期`
  - Diagonal stripes in category color, with the label `⏳ 暫停` → 暫停的專案（勾「顯示暫停」才會出現）
  - Grey block → 已完成或取消的專案（勾「顯示已結案」才會出現）
  - Light red column → 今天所在的週
  - `⚠` after a project name → 日期有缺漏、是推算的，或有問題；滑過去看原因
  - Blank cell → 這週沒有任務，而且不在專案區間，或專案已結案
- **Month view section**:
  - `✓` before greyed text → 已完成的任務
  - Text in warning red → 週已過還沒完成的任務
  - Normal text → 還沒完成、週還沒過的任務
  - The General row → 行事曆的行程，只能看；按 `↻` 重新讀取
  - A colored label before an event → 行事曆名稱；顏色在設定頁改
  - The `還沒排` number → 還沒排日期的任務；點一下排進這個月的某一週
- **Actions section**:
  - 點格子 → 打開那一週的任務，可以勾完成、換週、排進或新增任務
  - 點專案名稱 → 在右側開啟筆記
  - `◀` `▶` → 換年份或月份；`今年`、`本月` 回到現在
  - 勾「編輯分類與狀態」 → 改專案的分類與狀態
  - 拖拉或點圖例 → 調整分類順序，或把一類置頂
  - 拖拉專案欄的右邊 → 調整欄寬

When the panel is taller than the window, it SHALL scroll inside itself and SHALL NOT extend past the window.

The help panel MUST be a static DOM structure (not dynamically generated from data) so its content is always available regardless of which projects are loaded.

#### Scenario: Panel contains both sections

- **WHEN** the help panel is visible
- **THEN** the DOM MUST contain at least one element matching the shortcuts section (e.g., a `<section class="shortcuts">` or equivalent identifier)
- **AND** the DOM MUST contain at least one element matching the visual legend section
- **AND** the shortcuts section MUST include literal text matching `T` and `?` (or `/`)
- **AND** the visual legend section MUST include the substring `超出原訂結束日` (or equivalent explanation of the red color)

#### Scenario: Legend includes the settled state

- **WHEN** the help panel is visible
- **THEN** the visual legend section MUST include an entry explaining the settled state (a dimmed category-color block with a checkmark) with text matching `已全部完成` (or equivalent)

#### Scenario: Panel explains paused projects and actions

- **WHEN** the help panel is visible
- **THEN** the visual legend section MUST include the text `⏳ 暫停` and `暫停的專案`
- **AND** the panel MUST include an actions section with the text `編輯分類與狀態`
- **AND** the month view section MUST include the text `還沒排`

#### Scenario: Panel explains the month view

- **WHEN** the help panel is visible
- **THEN** the shortcuts section MUST include literal text matching `M`
- **AND** the panel MUST include the substring `週已過還沒完成`

