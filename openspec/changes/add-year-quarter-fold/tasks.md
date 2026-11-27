## 1. 鎖定驗收

- [ ] 1.1 先寫驗收測試（Quarters fold in the year view；The year view's 本週 button brings this week into view；Help panel content；設計：色條在折起的季邊上斷開、預設、保留與重設、本週按鈕取代今年、說明面板）：由一段只寫測試的 Codex 對話新增 tests/quarter-fold.test.ts（`quarterOfWeek` 對 2026 年 W1、W13、W14、W15、W27、W28、W40、W41、W53 的季（週一所在月份決定，Q2 從 W15、Q3 從 W28、Q4 從 W41 開始）；`defaultFoldedQuarters` 在 2026-11-20 回傳 `[1, 2, 3]`、2026-01-15 回傳 `[]`、`todayIdx` 為 -1 回傳 `[]`；`yearColumns` 在折起 1、3 時依序回傳 fold 1、weeks W15–W27、fold 3、weeks W41–W53，全部展開時回傳一段 0–53；`centeredScrollLeft` 的置中與夾在 0、`maxScrollLeft`；`columnFullyVisible` 的 1 像素容差）與 tests/year-quarter-fold-view.test.ts（用替身元素打開電腦版 view，今天固定 2026-11-20：情境「Past quarters start folded」「Expanding and folding a quarter」「The fold state survives drawing again」「Another year starts expanded」「Nothing is folded in the first quarter」「A bar stops at a folded quarter」，`本週` 的四個情境，`今年` 從不出現，Q1～Q3 折起時點整條虛線的某一週打開的是那一週，月視圖的 `本月` 不變）；並把 tests/help-panel.test.ts 的操作分頁文字改成 `本週、本月 回到現在`、加上 `折起來的一季` 與季標題那一行。主代理確認每個情境都對得上規格後記下雜湊鎖定。驗證：在目前的程式上執行，新測試因為還沒實作而失敗，既有測試仍通過。

## 2. 實作

- [ ] 2.1 純函式（設計：色條在折起的季邊上斷開）：新增 src/core/quarter-fold.ts，匯出 `quarterOfWeek`、`defaultFoldedQuarters`、`yearColumns`、`centeredScrollLeft`、`columnFullyVisible` 與 `YearColumn`，只依賴 src/core/weeks.ts。驗證：tests/quarter-fold.test.ts 全部通過。
- [ ] 2.2 年視圖畫出折起的季（Quarters fold in the year view；週欄寬度；甘特圖區域不受影響；設計：折疊做在季標題上、折起的季畫成一條窄欄、色條在折起的季邊上斷開、預設、保留與重設、樣式）：src/view.ts 的 `renderYearChart` 照 `yearColumns` 畫季、月、週三列與每列的窄欄，對每一段展開的週各算一次 `yearViewCells`；`th.week`、`td.week-cell` 帶 `data-week-index`，今天的 `th.week` 帶 `today-week`；`weekOfBarClick`、`anchorForWeek` 改用 `data-week-index`；新增 `foldedQuarters`／`foldYear` 與季標題的委派點擊；styles.css 加 `.quarter-toggle`、`.q-folded`、`.q-fold-gap`、`.q-fold-cell`。驗證：tests/year-quarter-fold-view.test.ts 的折疊情境與既有測試全部通過；展開的週欄仍是 32 像素、窄欄 40 像素、沒有折起時 53 週總寬 1,696 像素，由 3.1 的截圖量測確認。
- [ ] 2.3 本週按鈕（The year view's 本週 button brings this week into view；Switching between the year view and the month view；設計：本週按鈕取代今年）：src/view.ts 年視圖時 `periodCurrentBtn` 寫 `本週`、提示 `捲到本週`；新增 `updateThisWeekButton()`，在年視圖畫完、`#chart` 捲動、視窗大小改變、拖拉名稱欄寬結束時檢查；按下去依序切回今年、展開今天的季、用 `centeredScrollLeft` 捲動。驗證：tests/year-quarter-fold-view.test.ts 的 `本週` 情境通過，月視圖的 `本月` 測試仍通過。
- [ ] 2.4 說明面板（Help panel content；設計：說明面板）：src/view.ts 的說明面板年視圖分頁加窄欄示範那一行，操作分頁改切換那一行並加季標題那一行。驗證：tests/help-panel.test.ts 通過。

## 3. 截圖與文件

- [ ] 3.1 截圖與量測（設計：README、細節文件與截圖）：scripts/screenshots/capture.py 依設計重拍年視圖相關的 6 張截圖（`week-popover.png`、`paused-rows.png`、`status-editing.png` 之前先展開 Q1～Q3），加上折疊與 `本週` 的量測；scripts/screenshots/README.md 寫出新量測。驗證：`npm run screenshots:build` 再跑 `python3 scripts/screenshots/capture.py`，量測全部通過；`month-view.png`、`help-month.png`、`unscheduled-popover.png`、`settings-calendars.png`、`phone-month-view.png` 跟改之前逐位元相同；年視圖相關截圖逐張目視檢查沒有切字、沒有真實資料。
- [ ] 3.2 README、細節文件與更新紀錄（設計：README、細節文件與截圖）：README.md 與 README.zh-TW.md 的年視圖一節加上折疊與 `本週`，導覽句的 `今年` 改成 `本週`；docs/details.md 與 docs/details.zh-TW.md 寫出折疊的預設、保留、重設與 `本週` 的規則；CHANGELOG.md 的 0.6.0 英文與中文各補一條。驗證：重讀差異，兩份 README 的段落與圖片一致，`rg -n "今年" README.md README.zh-TW.md docs/details.zh-TW.md` 只剩跟年份導覽無關的用法。

## 4. 驗收

- [ ] 4.1 獨立審查與修正：派 Codex 唯讀審查這次的差異；會出錯的問題先補規格與鎖定測試再修。驗證：審查報告沒有未處理的「會出錯」項目。
- [ ] 4.2 自動驗收、部署與測試版：`npm test`、`npm run lint`、`npm run build` 全部通過；部署到本機 vault；版本改成 0.6.0-beta.4，從乾淨複本建置、比對雜湊、跑隱私檢查後發布測試版（不設成最新版）。驗證：貼出指令結果、三個檔案的雜湊與 Release 網址。
- [ ] 4.3 朱騏在電腦上實測：打開年視圖看 Q1～Q3 是否折起、點季標題展開與折起、捲走後按 `本週`、到 2027 再按 `本週`。驗證：朱騏在對話中確認。
