## 1. 純邏輯

- [x] 1.1 週的月份規則（A week belongs to the month of its Monday；設計：週的月份：週一規則，W01 永遠算一月）：src/core/months.ts 提供某週屬於哪個月、某月有哪些週、上一個月與下一個月、某日所屬月份、月視圖標題；src/core/weeks.ts 的 `buildWeeks` 改用同一條規則決定月份與季。驗證：tests/months.test.ts 逐列比對「weeks of a month」八列；tests/weeks.test.ts 逐列比對「2026 year header」八列（月份與季）；標題測試包含 `2026 年 10 月（W41–W44）`、`2026 年 11 月（W45–W49）`、`2027 年 1 月（W1–W4）`。
- [x] 1.2 格子內容與還沒排（Month cells list the week's task lines；Unscheduled task count per project；設計：格子內容與狀態用純函式算）：src/core/months.ts 的 `monthCellLines` 用 `taskLinesForWeek` 的結果與順序，標出 `done`、`overdue`、`open`；`unscheduledSummary` 用 `unscheduledTasks` 算數量與提示文字；src/core/cells.ts 提供月視圖每週的格子種類（任何年份的月份都能算），把 `span-dashed` 拆成每週 `dashed`；`blank` 格子不列任務文字。驗證：tests/months.test.ts 逐列比對「line state」五列、「Line states in one cell」情境、「Count and tooltip」情境；tests/cells.test.ts 測試一個沒有任務日期的專案在月視圖每週都是 `dashed`、有任務的週和年視圖同一週的種類相同、`2027-01` 這種不在今年的月份也算得出來；tests/months.test.ts 涵蓋「A blank week shows no text」情境。
- [x] 1.3 年／月偏好（Interface preferences use vault-scoped local storage）：src/core/prefs.ts 的 `parseScale` 只接受 `year` 與 `month`，其他一律 `year`。驗證：tests/prefs.test.ts 逐列比對 `dashboard.scale` 的三列範例。

## 2. 畫面

- [x] 2.1 年／月切換與月份導覽（Switching between the year view and the month view；Toggle view mode with T key；Keyboard shortcuts act only in the active dashboard tab；依類別排序按鈕；設計：年／月切換與月份導覽）：控制列加「年／月」切換；月視圖時顯示 `◀`、月份標題（週數不補零）、`▶`、`本月`；`M` 註冊在儀表板自己的快捷鍵範圍，`T` 在月視圖不作用；`dashboard.scale` 記住年或月，進月視圖一律顯示今天這週所屬的月份；切換月份或年／月時關掉開著的浮窗；控制列不出現任何排序控制項。驗證：純函式的月份切換有測試（含跨年）；畫面行為列入 3.3 手動驗收。
- [ ] 2.2 月視圖版面與格子（Month view layout；Month cells list the week's task lines；Unscheduled task count per project；Dashboard follows a consistent rendering and interaction model；週欄寬度；甘特圖區域不受影響；設計：月視圖獨立成元件、版面）：新增 src/month-view.ts，用 `weeksOfMonth` 自己的週列表畫專案欄、各週欄（`th.month-week`、`td.month-cell`，例如 `W44`、`10/26–11/1`；今天這週在顯示的月份裡才標示）、`還沒排` 欄；年視圖的 32px 週寬不受影響；列的順序、分組、篩選、編輯分類、專案名稱連結與年視圖相同；格子列出任務文字與狀態樣式、底色依格子種類；樣式全部用 styles.css 的類別與 CSS 變數。驗證：用維護者 vault 的真實筆記比對，月視圖每一格列出的任務行與年視圖同一週浮窗的任務行相同；畫面列入 3.3 手動驗收。
- [x] 2.3 從月視圖開浮窗與重繪（Clicking a month cell opens the week popover；Click a week cell to open a popover；Render bar continuously in timeline view mode；Re-render preserves the user's view state；設計：浮窗沿用，錨點換成月視圖的格子）：src/view.ts 的 `handleBarClick`、`weekOfBarClick`、`anchorForWeek`、`findWeekBar`、`reopenWeekPopover` 依目前顯示的視圖分開處理；月視圖格子帶 `data-path`、`data-week` 與格子種類，非 `blank` 的格子打開可編輯的週浮窗並以該格為錨點，不看 `dashboard.viewMode`；`overflow` 格子的浮窗標題顯示超出預計結束日期；同一格再點一次關閉；重繪時保留年或月視圖與顯示的月份，並在月視圖的同一格重新打開浮窗；timeline 模式只作用在年視圖。驗證：「Editing from the month view」與「The month view keeps its month」兩個情境列入 3.3 手動驗收；既有的浮窗與重繪測試全數通過。
- [x] 2.4 說明面板（Help panel content；設計：說明面板）：快捷鍵區加上 `M`（切換年 / 月），並標示 `T` 只作用在年視圖；新增月視圖區塊，說明打勾灰字、紅字、一般文字三種樣式，文字包含 `週已過還沒完成`。驗證：重讀說明面板的建立程式，確認規格列出的文字都在；畫面列入 3.3 手動驗收。

## 3. 文件與驗收

- [ ] 3.1 文件與版本：README 英文與中文新增月視圖的說明（切換、導覽、`M`、格子樣式、還沒排、週一規則）；CHANGELOG 新增 0.4.0（英文與中文，寫明年視圖表頭 W14、W27、W36、W40、W49 各往前一個月的原因）；manifest.json、package.json、package-lock.json 升到 0.4.0；openspec/LANGUAGE.md 新增月視圖、週的月份規則、還沒排數量的名詞，並更新既有的 `view-mode`（`T` 只作用在年視圖）、`week-popover`（也能從月視圖的格子打開）、說明面板相關條目；CHANGELOG 同時寫明 W14、W27、W40 換了季。驗證：重讀所有文件差異，確認中英段落內容一致、規則與規格相同。
- [ ] 3.2 自動驗收：`npm test` 全數通過、`npm run lint` 0 錯誤、`npm run build` 成功、`npm run deploy` 部署到本機 vault，依 AGENTS.md 的隱私檢查指令確認追蹤中的檔案沒有命中。驗證：貼出各指令結果與命中數。
- [ ] 3.3 朱騏在 Obsidian 手動驗收：切到月視圖看到 `2026 年 10 月（W41–W44）`，`◀`、`▶`、`本月` 正常；`M` 切換、`T` 在月視圖沒反應；格子的任務文字、打勾灰字、逾期紅字、底色正確；「還沒排」數量與提示正確；點格子開浮窗、勾選後月視圖原地更新且浮窗留在同一週；年視圖表頭 W40 在 9 月且在 Q3；切到別的月份時沒有欄位被標成今天、開著的浮窗會關掉；儲存為 timeline 模式時月視圖的格子仍能開可編輯的浮窗；重開 Obsidian 後回到月視圖且顯示本月。驗證：朱騏在對話中確認每一項結果。
