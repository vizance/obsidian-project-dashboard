# dashboard-sort-modes Specification

## Purpose

Sort visible projects by category priority, then by start date within each category, with a persisted user-defined category order.

## Requirements

### Requirement: 預設依 start date 排序

The dashboard SHALL sort visible projects by category in the order defined by the user's category priority list (persisted) or the built-in default priority list when no user preference exists. Within each category, projects SHALL be sorted by ascending `start` date. There SHALL be no alternative "sort by date" mode. Projects without `start` SHALL be filtered out before sorting (existing behavior).

#### Scenario: 預設載入時依類別排序

- **WHEN** 使用者首次載入儀錶板（無 localStorage 偏好）
- **THEN** 列表 MUST 先按 corporate → online_course → coaching → publishing → sponsorship → life → other 順序排列
- **AND** 同類別內列順序 MUST 按 `start` 升序

#### Scenario: 有 pin 時 pin 類別在最上、其他類別仍依儲存順序

- **WHEN** 使用者點擊某個 Legend item 進行 pin（例如 corporate）
- **THEN** corporate 類別 MUST 排在最上
- **AND** 其餘類別 MUST 仍依使用者儲存的優先順序（或預設順序）排列

---
### Requirement: 依類別排序按鈕

The previous toggle button labeled「依類別排序」(id `sort-by-category`) SHALL be removed from the UI. No alternative sort toggle SHALL replace it. The `.controls` block SHALL contain the「顯示已結案」checkbox, the「編輯分類」checkbox, the `年` / `月` switch, and, while the month view is shown, the month navigation (`◀`, the month title, `▶`, `本月`); it SHALL NOT contain any sort control.

#### Scenario: 按鈕不再出現

- **WHEN** 使用者載入儀錶板
- **THEN** `document.getElementById('sort-by-category')` MUST 回傳 `null`
- **AND** `.controls` 區塊內 MUST NOT 有任何排序用的控制項

---
### Requirement: Legend pin 維持既有行為

Clicking a Legend item SHALL pin that category's projects to the top of the list (above all other categories), with the rest of the list keeping default start-date order. Clicking the same Legend item again SHALL unpin. Only one Legend pin SHALL be active at a time.

#### Scenario: 點 Legend item pin 單一類別

- **WHEN** 使用者點擊「企業內訓」legend item（從未 active 切換到 active）
- **THEN** 所有 `corporate` 類別專案 MUST 連續排在最前面
- **AND** 其餘專案（非 corporate）MUST 仍依 start date 排序
- **AND** 該 legend item MUST 套上 `active` class

#### Scenario: 再點同一個 Legend item 取消 pin

- **WHEN** 使用者點擊已 active 的「企業內訓」legend item
- **THEN** pin 狀態 MUST 取消
- **AND** 排序 MUST 回到預設依 start date 排序

---
### Requirement: 兩種排序模式互斥

The dashboard SHALL support exactly two sort behaviors: (a) the default category-priority sort (always active), and (b) an optional Legend pin that brings one category to the very top while preserving the category-priority order for the remaining categories. These two SHALL stack (pin overrides per-category position, default order applies to the rest).

#### Scenario: pin 與類別排序協同運作（不再互斥）

- **GIVEN** 使用者已透過拖拉 Legend 設定類別順序為 `[publishing, online_course, corporate, ...]`
- **WHEN** 使用者點 corporate Legend item 進行 pin
- **THEN** corporate 類別 MUST 排在最上（覆寫 pin 規則）
- **AND** 其餘類別 MUST 依 publishing → online_course → ... 的儲存順序排列

---
### Requirement: 維持既有色條與互動行為

This sort feature MUST NOT alter: bar geometry calculation (start/end/promised_end), solid/dashed segment split, closed grayscale fade, monthly/quarterly/weekly divider rendering, today red column highlight, light theme,「顯示已結案」checkbox filter, column widths and padding.

#### Scenario: 互動回歸驗證

- **WHEN** 套用本次變更後重新載入儀錶板
- **THEN** 跨多週進行中專案色條 MUST 仍呈現 solid + dashed 分段
- **AND** 今日週欄位 MUST 仍顯示 `rgba(239, 68, 68, 0.12)` 紅色淡底
- **AND** 「顯示已結案」勾選切換 MUST 仍正確運作
- **AND** done / cancelled 色條 MUST 仍套用 grayscale + opacity 0.35
- **AND** 三層分隔線、亮色主題 MUST 維持

---
### Requirement: 拖拉 Legend 重排類別優先序

The dashboard SHALL allow the user to reorder categories by horizontally dragging Legend items. A drag SHALL be triggered when the mouse moves more than 5 pixels (in any direction) between `mousedown` and `mouseup` on a Legend item. A movement of 5 pixels or less SHALL be treated as a click (the existing pin behavior). During a drag, the dragged item SHALL be visually marked (opacity 0.5) and the new insertion position SHALL be indicated on hover-over targets.

#### Scenario: 拖拉觸發 reorder

- **GIVEN** Legend 順序為 `[corporate, online_course, coaching, publishing, sponsorship, life, other]`
- **WHEN** 使用者按住 `publishing` Legend item，向左拖到 `corporate` 的左側（位移 > 5px 且 mouseup 在 corporate 之前）
- **THEN** 新的 Legend 順序 MUST 為 `[publishing, corporate, online_course, coaching, sponsorship, life, other]`
- **AND** 表格中的列順序 MUST 即時依新順序重排

##### Example: 把出版拖到最前
- **GIVEN** 預設順序 `[corporate, online_course, coaching, publishing, sponsorship, life, other]`、共有 1 個 publishing 專案 A、1 個 corporate 專案 B
- **WHEN** 使用者拖 publishing 到最前
- **THEN** 表格中 A 列 MUST 出現在 B 列之前

#### Scenario: 位移小於閾值視為點擊（pin/unpin）

- **WHEN** 使用者在 Legend item 上 mousedown 然後 mouseup，且兩個事件之間滑鼠位移 ≤ 5px
- **THEN** 該動作 MUST 被視為 click
- **AND** 既有的 pin / unpin 行為 MUST 正常觸發

---
### Requirement: 類別順序持久化

The category order SHALL be persisted to `localStorage` under the key `dashboard.categoryOrder` as a JSON-stringified array of category keys (e.g., `'["publishing","corporate","online_course",...]'`). On page load, the dashboard SHALL read this key and apply the stored order. When the key is absent, contains invalid JSON, or contains a non-array value, the dashboard SHALL use the built-in default order `[corporate, online_course, coaching, publishing, sponsorship, life, other]`.

#### Scenario: 拖拉後寫入 localStorage

- **WHEN** 使用者完成一次拖拉，Legend 順序變為 `[publishing, online_course, corporate, coaching, sponsorship, life, other]`
- **THEN** `localStorage.getItem('dashboard.categoryOrder')` MUST 回傳字串 `'["publishing","online_course","corporate","coaching","sponsorship","life","other"]'`

#### Scenario: 載入時套用儲存順序

- **GIVEN** `localStorage.getItem('dashboard.categoryOrder')` 為字串 `'["publishing","corporate","online_course","coaching","sponsorship","life","other"]'`
- **WHEN** 使用者重新整理頁面
- **THEN** Legend 渲染順序 MUST 從左至右為 publishing → corporate → online_course → coaching → sponsorship → life → other
- **AND** 表格中專案排序 MUST 依此順序

#### Scenario: 損毀或缺失時使用預設順序

- **GIVEN** `localStorage.getItem('dashboard.categoryOrder')` 為 `null` 或非 JSON 陣列字串（例如 `'abc'`）
- **WHEN** 使用者載入儀錶板
- **THEN** Legend MUST 使用預設順序 `[corporate, online_course, coaching, publishing, sponsorship, life, other]`

#### Scenario: 儲存順序含未知或缺失 key 時自動修正

- **GIVEN** `data.categories` 的有效 key 為 `[corporate, online_course, coaching, publishing, sponsorship, life, other]`
- **AND** `localStorage` 儲存的順序為 `["publishing","unknown_cat","corporate"]`（缺多個有效 key、含一個未知 key）
- **WHEN** 使用者載入儀錶板
- **THEN** 套用的順序 MUST 為 `[publishing, corporate, online_course, coaching, sponsorship, life, other]`（保留儲存順序的有效部分、忽略 `unknown_cat`、附加缺失 key 到末尾）

---
### Requirement: Legend pin 狀態持久化

The currently pinned category SHALL be persisted to `localStorage` under the key `dashboard.pinnedCategory`. After each pin or unpin action, the dashboard SHALL write the current `pinnedCategory` value (a category key string or `null`) using `JSON.stringify` to this key. On page load, the dashboard SHALL read this key, parse it with `JSON.parse`, validate that the parsed value is either `null` or a string equal to one of the keys in `data.categories`, and apply it as the initial pinned category. When the key is absent, contains invalid JSON, contains a non-string non-null value, or contains a string that does not match any key in `data.categories`, the dashboard SHALL fall back to `null` (no pin).

#### Scenario: pin 後寫入 localStorage

- **GIVEN** 使用者尚未 pin 任何類別
- **WHEN** 使用者點擊 `life` Legend item 進行 pin（位移 ≤ 5px）
- **THEN** `localStorage.getItem('dashboard.pinnedCategory')` MUST 回傳字串 `'"life"'`（含外層引號的 JSON 字串）

#### Scenario: unpin 後寫入 null

- **GIVEN** `life` 類別目前處於 pin 狀態
- **WHEN** 使用者再次點擊 `life` Legend item 取消 pin
- **THEN** `localStorage.getItem('dashboard.pinnedCategory')` MUST 回傳字串 `'null'`

#### Scenario: 重新整理後套用儲存的 pin

- **GIVEN** `localStorage.getItem('dashboard.pinnedCategory')` 為 `'"life"'`
- **WHEN** 使用者重新整理儀錶板頁面
- **THEN** `life` Legend item MUST 帶有 `active` class
- **AND** 列表中相鄰的最上方數列 MUST 為 life 類別專案
- **AND** `window._pinnedCategory` MUST 等於字串 `'life'`

##### Example: 重新打開仍記得 pin 的生活
- **GIVEN** 使用者上次將「生活」（`life`）pin 到最上，並寫入 `localStorage.dashboard.pinnedCategory = '"life"'`
- **WHEN** 使用者隔天重新打開瀏覽器，重新載入儀錶板
- **THEN** 生活類別 MUST 自動排在最上方
- **AND** 使用者無需再次點擊即可看到 pin 效果

#### Scenario: 損毀或不存在的 key 時 fallback

- **GIVEN** `localStorage.getItem('dashboard.pinnedCategory')` 為 `'invalid_json{'` 或 `'"unknown_cat"'`（一個不存在的 category key）
- **WHEN** 使用者載入儀錶板
- **THEN** `window._pinnedCategory` MUST 為 `null`
- **AND** 任何 Legend item MUST 不帶 `active` class
- **AND** 列表 MUST 按使用者類別順序（無 pin override）排列
