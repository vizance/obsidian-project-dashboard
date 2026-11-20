## 1. 純邏輯

- [x] 1.1 切換時決定期間（Switching between the year view and the month view；設計：顯示的年份放在記憶體，切換年／月時沿用正在看的期間）：src/core/months.ts 新增純函式，年切月時「顯示今年 → 今天這週所屬的月份；別的年份 → 那一年的一月」，月切年時「那個月的年份」。驗證：tests/months.test.ts 涵蓋三種情況：今天 `2026-11-20` 顯示 2026 年切月得 `2026-11`、顯示 2027 年切月得 `2027-01`、顯示 `2027-03` 切年得 2027。
- [x] 1.2 跨年專案的年視圖格子（Calendar year follows today's local date；設計：跨年專案：不在索引上補洞，改用跟月視圖相同的「連續週」做法）：src/core/cells.ts 新增年視圖用的格子函式（per-week 與 timeline），在同時蓋住專案完整範圍與顯示年份的連續週上，用既有的 `perWeekCells`／`timelineCells` 計算，再取出這一年的週，跨出這一年的整條色條裁到這一年範圍內。驗證：tests/cells.test.ts 涵蓋「Overflow into the next year」情境（per-week：2027 `W2` 是 `overflow`、`W1` 是 `blank`；timeline：色條 `W1`–`W2`）、`buildWeeks(2027)` 有 52 週、起點在前一年的整條虛線從 `W1` 開始、終點在後一年的色條到最後一週為止；今年的既有格子測試全數通過。

## 2. 畫面

- [x] 2.1 年份導覽與按需出現的回到現在（Switching between the year view and the month view；Re-render preserves the user's view state；設計：年份導覽和月份導覽共用控制列同一個位置）：src/view.ts 新增記憶體裡的 `shownYear`；控制列的導覽依視圖顯示月份或年份（`◀` 提示 `上一年`、`<year> 年`、`▶` 提示 `下一年`、`今年` 提示 `回到今年`）；`今年` 與 `本月` 只在顯示的期間不是現在時出現；年切月、月切年用 1.1 的函式；換期間或切換年／月關掉浮窗；年視圖用 `shownYear` 建週並改用 1.2 的格子函式；今天欄只在顯示今年時標示；重繪保留 `shownYear`。驗證：規格的「Moving to next year in the year view」「Switching keeps the period being planned」「The current year still opens on this month」「Restart returns to today」「The year view keeps its year」列入 3.3 手動驗收；既有測試全數通過。

## 3. 文件與驗收

- [ ] 3.1 文件（設計：文件與版本）：README 英文與中文的年視圖說明加上切換年份、`今年`／`本月` 按需出現、切換時沿用期間；CHANGELOG 0.5.0 英文與中文各加一段（含跨年格子修正的原因）；openspec/LANGUAGE.md 更新 `month-view`、`view-mode` 等提到年份固定為今年的條目。驗證：重讀差異，中英一致，與規格相同。
- [ ] 3.2 自動驗收與真實資料比對：`npm test`、`npm run lint`（0 錯誤）、`npm run build` 通過；用維護者 vault 比對今年年視圖每一格的新舊結果，差異只出現在「專案在去年就結束、今年還有超出期限任務」的專案並列出；部署到本機 vault；依 AGENTS.md 的隱私檢查確認沒有命中。驗證：貼出各指令結果、比對結果與命中數。
- [ ] 3.3 朱騏在 Obsidian 手動驗收：年視圖按 `▶` 到 2027 年、出現 `今年`、按 `今年` 回到 2026；2027 年沒有今天欄；在 2027 年切到月視圖是 2027 年 1 月，往後翻再切回年視圖仍是 2027 年；今年切月視圖是本月；`本月` 只在別的月份才出現；重開 Obsidian 回到今年；跨到明年的專案格子正確。驗證：朱騏在對話中確認。
- [ ] 3.4 封存順序：先封存 add-calendar-row，再封存這個改動（`Re-render preserves the user's view state` 以 add-calendar-row 的版本為底）。驗證：封存後 openspec/specs/dashboard-note-sync/spec.md 同時包含行事曆讀取的觸發條件與「the year shown in the year view」。
