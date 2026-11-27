## Context

年視圖（電腦與平板）由 view.ts 的 `renderYearChart` 畫成一張表：

- 表頭三列：季（`th.quarter`，colspan 等於那一季的週數）、月（`th.month-label`）、週（`th.week`，每週 32 像素）。
- 每個專案一列：名稱欄（280 像素，可以拖拉）加上每週一格 `td.week-cell`。季與月的第一週帶 `q-start`／`m-start` 畫分隔線，今天那週的格子帶 `today-col`（淡紅底）。
- 色條由純函式 `yearViewCells(project, weeks, settings, viewMode)` 算出每一格的種類。`per-week` 模式一週一格；沒有任務日期的專案畫成一整條虛線（`span-dashed`），`timeline` 模式畫成一整條實線（`span-solid`），都只畫在起始格，用 `--pd-span` 撐寬蓋過後面的格子。
- 點整條虛線時，`weekOfBarClick` 用「這一列第幾個 `td.week-cell`」換算點到哪一週；`anchorForWeek` 與 `findWeekBar` 也是用週在 `this.weeks` 的位置去找格子。
- 控制列的期間導覽在年視圖是 `◀ 2026 年 ▶`，後面的 `今年` 只在看別的年份時出現（`updateScaleControls` 設定文字與顯示）。

整年 53 週加名稱欄約 1,980 像素。現在是 11 月，朱騏要往右捲過三季才看得到這幾週。

朱騏的原話：「在『年』的預覽上面，像現在已經 Q4 了，Q1、Q2、Q3 感覺應該要是可以折疊的，要不然其實我都要滾到最後。」「可不可以加上一個『本週』的按鈕，讓我可以直接 zoom in 到這一週？」討論時提了「跳到月視圖」與「新增週視圖」兩個做法，他說明：「其實我的『本週』在電腦上，只是要能夠直接跳到整個年視圖裡面那個紅色的『本週』的意思」。

介面簡化檢查的四題：

1. **誰、在做什麼事的途中？** 朱騏在電腦上打開年視圖，想看最近幾週各專案的狀況，往右捲是多出來的步驟。
2. **主要工作還是附帶的事？** 看最近幾週是主要工作，所以折疊要是預設，不用每次手動點。
3. **能不能併進既有的控制項？** 折疊直接做在既有的季標題上，不另外放按鈕。`本週` 放在 `今年` 原本的位置並取代它：按 `本週` 本來就會回到今年，兩顆按鈕只會重複。
4. **多久用一次？** 每次打開年視圖都會看到折疊的結果；`本週` 只在本週不在眼前時才出現（沿用「回到現在只在離開現在時出現」）。

## Goals / Non-Goals

**Goals:**

- 打開今年的年視圖時，過去的季折起，本週附近一打開就在眼前。
- 任何一季都能點季標題折起或展開，在同一個年份裡保留。
- 本週那一欄不在眼前時，按一下 `本週` 就把它捲到正中間。
- 沒有折起任何季時，年視圖跟現在完全一樣（除了季標題多一個 `▾`）；月視圖與手機完全不變。

**Non-Goals:**

- 把折疊狀態存進偏好或筆記，下次打開沿用。
- 折起的窄欄裡畫摘要（例如那一季有幾個任務、哪些專案有動）。
- 新增週視圖，或讓 `本週` 切到月視圖。
- `本週` 的快捷鍵。
- 打開年視圖時自動左右捲到本週（折疊之後本週通常已經在眼前，用 `本週` 補足其餘情況）。
- 在月視圖加 `本週`，或改動月視圖的 `本月`。
- 平板上用手勢折疊。

## Decisions

### 折疊做在季標題上

季標題 `th.quarter` 裡放一顆 `button.quarter-toggle`（`type="button"`、`data-quarter="1"`～`"4"`），文字是 `Q1 ▾`（展開）或 `Q1 ▸`（折起），提示 `折起這一季`／`展開這一季`，`aria-expanded` 跟著改。按鈕用樣式去掉 Obsidian 預設的外框與底色，看起來跟原本的季標題一樣，滑過去顯示手指游標。展開的季也帶 `▾`，讓人知道標題可以點。

替代方案：在控制列放「折起過去的季」開關。多一顆按鈕，而且只能整批折，所以不採用。

### 折起的季畫成一條窄欄

- 季列：`th.quarter.q-folded`，colspan 1，寬 40 像素，裡面是那一季的按鈕。
- 月列與週列：一格 `th.q-fold-gap`，rowspan 2，空白。
- 每個專案列：一格 `td.q-fold-cell`，空白，底色 `--panel`，左邊框 2 像素（跟季分隔線同色）。沒有色條、沒有 `data-path`／`data-week`，所以點了不會開浮窗（落到既有的「點外面就關閉」分支）。
- 沒有專案時的那一列與出錯時的備用列，也要照同樣的欄位結構畫，表格才不會錯位。

窄欄裡不畫摘要：年視圖目前的紅色只代表「超出預計結束日期」，過去的季被折起時，最近的週仍然看得到；要細看就點標題展開。

### 色條在折起的季邊上斷開

新增純函式模組 `src/core/quarter-fold.ts`：

- `quarterOfWeek(week: WeekInfo): number`：照 `dashboard-month-view` 的規則（週一所在的月份，W1 屬於一月）回傳 1～4。
- `defaultFoldedQuarters(weeks: WeekInfo[], todayIdx: number): number[]`：`todayIdx < 0` 時回傳 `[]`；否則回傳今天那週所在季之前的季，由小到大。
- `yearColumns(weeks: WeekInfo[], folded: ReadonlySet<number>): YearColumn[]`，`YearColumn` 是 `{ kind: 'weeks'; start: number; end: number }`（`weeks` 的索引，`end` 不含）或 `{ kind: 'fold'; quarter: number }`。依序輸出；相鄰的展開季合併成同一段 `weeks`，所以兩個展開的季之間色條照舊連續。
- `centeredScrollLeft(input: { scrollLeft: number; columnLeft: number; columnRight: number; areaLeft: number; areaRight: number; maxScrollLeft: number }): number`：回傳 `scrollLeft + (columnLeft + columnRight) / 2 − (areaLeft + areaRight) / 2`，夾在 0 到 `maxScrollLeft`，四捨五入成整數。
- `columnFullyVisible(column: { left: number; right: number }, area: { left: number; right: number }): boolean`：`column.left >= area.left - 1 && column.right <= area.right + 1`。

`renderYearChart` 照 `yearColumns` 畫：季列與月列只對 `weeks` 段裡的週用既有的 `groupQuarters`／`groupMonths`。每個專案列對每一段 `weeks` 各呼叫一次 `yearViewCells(project, weeks.slice(start, end), settings, viewMode)`，所以整條虛線與 Timeline 實線會在折起的季邊上停住；整段都被折起的色條就不會畫出來。`yearViewCells` 本身不改。

`this.weeks` 仍是整年的週。每個 `td.week-cell` 與 `th.week` 加 `data-week-index`（在整年 `weeks` 裡的索引）。整條色條的 `data-span-start` 也是整年的索引。`weekOfBarClick`、`anchorForWeek` 改成用 `data-week-index` 找格子，不再用「這一列第幾個 `td.week-cell`」；`findWeekBar` 的比對本來就用整年索引，不用改。今天那週的 `th.week` 加類別 `today-week`（只用來量位置，沒有樣式）。

替代方案：照畫全部 53 欄，用樣式藏起折起的欄。colspan 會跟著錯，色條也會蓋進被藏的欄，所以不採用。

### 預設、保留與重設

view 多兩個欄位：`foldedQuarters: Set<number>` 與 `foldYear: number | null`。`renderYearChart` 開始時，若 `foldYear !== this.shownYear`，就用 `defaultFoldedQuarters` 重設並把 `foldYear` 設成 `shownYear`。今天那週的判斷沿用既有的 `todayIdx`（顯示的年份等於今天的西元年才有）。

所以：同一個年份的任何重繪（筆記改變、設定改變、顯示已結案、顯示暫停、`T`、切到月視圖再切回同一年）都保留；換年份就重設；分頁重開時 `foldYear` 是 `null`，也會重設。不寫入 local storage。

按季標題：切換那一季在 `foldedQuarters` 的狀態，記下 `#chart.scrollLeft`，重畫圖表（重畫會照既有規則關掉浮窗），再把 `scrollLeft` 設回去（瀏覽器會夾在新的範圍內），最後把焦點放回同一季的新按鈕（`focus({ preventScroll: true })`，不讓瀏覽器為了焦點捲動表格）。重畫會換掉原本的按鈕，不放回去的話用鍵盤的人會失去位置（審查時發現）。季標題的點擊用 `#chart` 上的委派事件處理，跟既有的點名稱、點色條同一個做法；處理完要停止，不要再落到「點外面就關閉浮窗」以外的分支。

### 本週按鈕取代今年

- 沿用既有的 `periodCurrentBtn`。年視圖時文字 `本週`、提示 `捲到本週`；月視圖時照舊 `本月`。
- 出現與否由新的 `updateThisWeekButton()` 決定（只在 `scale === 'year'` 時；月視圖照舊由 `updateScaleControls` 管 `本月`）：
  - 顯示的年份不是今天的西元年 → 出現。
  - 是今年，但 `todayIdx < 0`（今天的週不在這一年的欄裡）→ 不出現。
  - 今天那週所在的季被折起 → 出現。
  - 否則量 `th.week.today-week` 與 `th.proj-col` 的 `getBoundingClientRect()`，可見範圍是「名稱欄右緣」到「`#chart` 右緣」；`columnFullyVisible` 為 false → 出現。
- 檢查的時機：年視圖每次畫完圖表、`#chart` 的 `scroll` 事件、視窗 `resize`、儀表板窗格大小改變、拖拉名稱欄寬結束。都用 `registerDomEvent` 註冊，分頁關閉時自動移除。窗格大小改變用 Obsidian 的 `ItemView.onResize()`：拖拉旁邊的分割、把分頁搬到別的視窗時，視窗本身沒有 `resize`，只有窗格會收到這個通知（審查時發現）。
- 按 `本週`：顯示的年份不是今年時先切到今年（走既有的 `showYear`，所以折疊會重設成今年的預設）；今天的季被折起就展開並重畫；最後若今天的週有欄位，用 `centeredScrollLeft` 算出 `#chart.scrollLeft`（`maxScrollLeft = scrollWidth − clientWidth`），然後再跑一次 `updateThisWeekButton()`。
- `今年` 這兩個字不再出現在年視圖。

替代方案：`本週` 一直顯示。違反「回到現在只在離開現在時出現」，而且打開時本週多半已經在眼前，所以不採用。

### 樣式

全部掛在 `.project-dashboard` 底下，只用新類別，不改既有規則的值：

- `th.quarter .quarter-toggle`：繼承字型、字級、顏色與字距，沒有外框、底色、陰影，寬 100%，`cursor: pointer`。去掉陰影也去掉了 Obsidian 用陰影畫的焦點外框，所以另加 `:focus-visible` 的 `outline: 2px solid var(--interactive-accent)`、`outline-offset: -2px`（審查時發現）。
- `th.quarter.q-folded`、`th.q-fold-gap`、`td.q-fold-cell`：寬、最小寬、最大寬都是 40 像素；`td.q-fold-cell` 與 `th.q-fold-gap` 底色 `var(--panel)`，左邊框 `2px solid var(--grid)`。
- 說明面板的示範列用同樣的類別畫一格窄欄。
- 年視圖的表格加類別 `year-grid`，`.project-dashboard table.gantt.year-grid` 設 `min-width: 0`。原本 `table.gantt` 的 `min-width: 100%` 會在表格比圖表區域窄時把每一欄撐寬（折起三季後週欄從 32 像素變成約 56 像素），違反週欄固定 32 像素。改了之後多出來的空間留在表格右邊。月視圖的表格沒有 `year-grid`，不受影響。

### 說明面板

- 年視圖分頁「顏色與欄位」加一行：灰色窄欄示範 → `折起來的一季；點季標題展開或折起`。
- 操作分頁「切換」那一行改成 `◀ ▶ → 換年份或月份；本週、本月 回到現在`；「版面」加一行 `點季標題（例如 Q1） → 折起或展開那一季（只在年視圖）`。

### README、細節文件與截圖

- README 兩種語言的年視圖一節：說明過去的季會折成窄欄、點季標題展開或折起；本週不在眼前時按 `本週` 捲回來。導覽那一句把 `今年` 改成 `本週`。
- docs/details 兩種語言：折疊的預設、保留與重設規則，`本週` 何時出現、按下去做什麼。
- CHANGELOG 的 0.6.0 英文與中文各補一條。
- 截圖（今天固定 2026-11-20）：
  - `year-view.png`：打開時的預設樣子，Q1～Q3 折起，`本週` 不出現。
  - `help-year.png`：重拍，含新的一行。
  - `week-popover.png`、`paused-rows.png`、`status-editing.png`：先把 Q1～Q3 都展開再拍，畫面跟以前一樣看得到整年（季標題多了 `▾`）。
  - `year-2027.png`：2027 年四季都展開，`本週` 出現在 `▶` 後面。
  - 月視圖、設定、手機的截圖（`month-view.png`、`help-month.png`、`unscheduled-popover.png`、`settings-calendars.png`、`phone-month-view.png`）要跟改之前逐位元相同。
- 截圖腳本加量測：2026 年預設時季標題文字、只有 W41～W53 的週欄、三條窄欄各 40 像素、`本週` 隱藏；四季都展開、畫布 1,100 像素寬、捲到最左時 `本週` 出現，按下去後 W47 完整在可見範圍內、與中心相差不超過 1 像素或已捲到最右（W47 離年底太近時）、`本週` 隱藏；量不對就失敗。

## Implementation Contract

**可以觀察到的行為：**

- 今天 2026-11-20 打開 2026 年視圖：季標題 `Q1 ▸`、`Q2 ▸`、`Q3 ▸`、`Q4 ▾`，週欄只有 W41～W53，每列三格窄欄，`本週` 不出現（本週在眼前時），`今年` 不出現。
- 點 `Q2 ▸`：W15～W27 出現在 Q1 窄欄與 Q3 窄欄之間，標題變 `Q2 ▾`；再點一次折回去。筆記改了重繪後狀態不變。
- 按 `▶` 到 2027：四季展開，52 欄，`本週` 出現；按 `本週` 回到 2026，Q1～Q3 折起，W47 在眼前。
- `timeline` 模式下 2026-08-03～2026-11-30 的專案：Q3 折起時一條從 W41 開始、9 週的實線；展開 Q3 後一條從 W32 開始、18 週的實線。
- 點整條虛線的某一週，打開的仍是那一週的浮窗（Q1～Q3 折起時也一樣）。
- 月視圖、手機、說明面板以外的電腦畫面行為不變。

**介面與資料形狀：**

- `src/core/quarter-fold.ts` 匯出 `quarterOfWeek`、`defaultFoldedQuarters`、`yearColumns`、`centeredScrollLeft`、`columnFullyVisible` 與型別 `YearColumn`，簽名如 Decisions 所寫。
- DOM：`th.quarter > button.quarter-toggle[data-quarter][aria-expanded]`；折起時 `th.quarter.q-folded`、`th.q-fold-gap`、`td.q-fold-cell`；`th.week` 與 `td.week-cell` 帶 `data-week-index`；今天那週的 `th.week` 帶 `today-week`；整條色條的 `data-span-start` 是整年索引。
- 年視圖的 `periodCurrentBtn` 文字 `本週`、title `捲到本週`。

**失敗時：**

- 量不到版面（`#chart` 寬度是 0）時，`updateThisWeekButton` 直接當作本週不在眼前，`本週` 出現；按下去照樣捲動，不會出錯。
- 今天的週不在顯示年份的欄裡時，`本週` 只切年份、不捲動。

**驗收方式：**

- `tests/quarter-fold.test.ts`（純函式）與 `tests/year-quarter-fold-view.test.ts`（用替身元素打開電腦版 view）由另一段 Codex 對話先寫、主代理確認後鎖定；`tests/help-panel.test.ts` 的操作分頁文字一起更新。
- 既有測試全部通過，`npm run lint` 0 個錯誤、`npm run build` 通過。
- 截圖腳本的量測通過；月視圖、設定、手機的 5 張截圖逐位元相同；年視圖相關的 6 張截圖逐張目視檢查。
- 朱騏在電腦上實測。

**範圍：**

- 範圍內：年視圖的季折疊、`本週`、說明面板、README／細節文件／更新紀錄、截圖與量測。
- 範圍外：Non-Goals 列出的項目；月視圖與手機的任何改變。

## Risks / Trade-offs

- [季標題多了 `▾`，所有年視圖截圖都會變] → 重拍並逐張目視檢查；月視圖、設定、手機截圖仍要逐位元相同。
- [折起的季把那幾週的色條藏起來，包括超出預計結束日期的紅色] → 只在今年預設折起「已經過去」的季，最近的週一直看得到；點標題就展開。
- [`#chart` 的 scroll 事件很頻繁] → `updateThisWeekButton` 只量兩個元素，不重畫。
- [Obsidian 的按鈕樣式可能蓋過季標題按鈕的樣式] → 選擇器帶 `.project-dashboard th.quarter`，權重高於 Obsidian 的 `button`；截圖目視確認。
- [平板上沒有滑鼠游標提示] → 標題上的 `▾`／`▸` 本身就說明可以點。

## Migration Plan

- 跟手機版一起放進 0.6.0：先發 0.6.0-beta.4 測試版給朱騏在電腦上試，確認後再發正式版。
- 退回的方法：發一版拿掉折疊與 `本週`，恢復 `今年`。

## Open Questions

（無）
