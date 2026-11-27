## MODIFIED Requirements

### Requirement: Help panel content

The help panel SHALL organize its content into three tabs labelled `年視圖`, `月視圖`, and `操作`, shown at the top of the panel. Only the selected tab's content SHALL be shown. The selected tab SHALL be marked by at least two cues (bold label and an accent-colored underline), and the tabs SHALL be keyboard accessible (`role="tablist"`/`tab`/`tabpanel`, arrow keys move between tabs). Each time the panel opens, the selected tab SHALL be `年視圖` when the year view is shown and `月視圖` when the month view is shown; clicking a tab switches to it. Within a tab, items SHALL be grouped under short subheadings, one short line per item, and every visual item SHALL show a sample drawn with the same classes the chart uses.

`年視圖` SHALL contain these groups and items:

- **每一格＝這週的任務**:
  - Solid filled block in category color → 有任務，還沒全部完成
  - Dimmed block with a checkmark (✓) → 這週的任務都完成了
  - Dashed border block → 在專案期間內，這週沒有任務
  - Blank cell → 沒有任務，也不在專案期間（或專案已結案）
- **需要注意**:
  - Solid block in warning red → 超出預計結束日期還有任務；可以更新 frontmatter 的 `預計結束日期`
  - `⚠` after a project name → 日期有缺漏、是推算的，或有問題；滑過去看原因
- **整列＝專案狀態**:
  - Diagonal stripes with the label `⏳ 暫停` → 暫停的專案（勾「顯示暫停」才會出現）
  - Grey block → 已完成或取消的專案（勾「顯示已結案」才會出現）
- **顏色與欄位**:
  - Category-colored dot → 專案的分類，對照上方圖例
  - Light red column → 今天所在的週
  - Narrow grey column under `Q1 ▸` → 折起來的一季；點季標題展開或折起

`月視圖` SHALL contain these groups and items:

- **格子裡的任務文字**:
  - `✓` before greyed text → 已完成的任務
  - Text in warning red → 週已過還沒完成的任務
  - Normal text → 還沒完成、週還沒過的任務
- **格子底色**:
  - One line → 底色的意思和年視圖一樣（實心、淡色、虛線、紅色、斜線紋）
- **General 列（行事曆）**:
  - A colored label before an event → 行事曆名稱；顏色在設定頁改
  - `↻` → 重新讀取行事曆；行程只能看，不能改
- **還沒排**:
  - The `還沒排` number → 還沒排日期的任務；點一下排進這個月的某一週

`操作` SHALL contain these groups and items:

- **編輯**:
  - 點格子 → 打開那一週的任務：勾完成、換週、排進或新增任務
  - 點專案名稱 → 在右側開啟筆記
  - 勾「編輯分類與狀態」 → 改專案的分類，或改成暫停、完成、取消
- **切換**:
  - `年` / `月`，或按 `M` → 切換年視圖與月視圖
  - `◀` `▶` → 換年份或月份；`本週`、`本月` 回到現在
  - `T` → 切換逐週與 Timeline（只在年視圖）
  - `?` → 打開或關閉這個面板
- **版面**:
  - 點圖例 → 把一類置頂；拖拉圖例 → 調整分類順序
  - 拖拉專案欄的右邊 → 調整欄寬
  - 點季標題（例如 `Q1`） → 折起或展開那一季（只在年視圖）

When the panel is taller than the window, it SHALL scroll inside itself and SHALL NOT extend past the window. The help panel MUST be a static DOM structure (not dynamically generated from data) so its content is always available regardless of which projects are loaded.

#### Scenario: The panel opens on the tab of the current view

- **GIVEN** the month view is shown
- **WHEN** the user presses `?`
- **THEN** the `月視圖` tab MUST be selected and its content shown
- **AND** the `年視圖` and `操作` content MUST be hidden

#### Scenario: Switching tabs

- **GIVEN** the help panel is open on `年視圖`
- **WHEN** the user clicks `操作`
- **THEN** the `操作` content MUST be shown and contain `編輯分類與狀態` and `M`
- **AND** the `年視圖` content MUST be hidden

#### Scenario: Year tab groups

- **WHEN** the `年視圖` tab is shown
- **THEN** it MUST show the subheadings `每一格＝這週的任務`, `需要注意`, `整列＝專案狀態`, and `顏色與欄位`
- **AND** it MUST include `⏳ 暫停`, `暫停的專案`, `超出預計結束日期`, and `折起來的一季`

#### Scenario: Month tab groups

- **WHEN** the `月視圖` tab is shown
- **THEN** it MUST include `週已過還沒完成`, `還沒排`, and `行事曆名稱`
