## 1. 格子模型

- [x] 1.1 每週獨立判斷（Render bars per-week based on occupied_weeks；Month cells list the week's task lines；Calendar year follows today's local date；One project's dates cannot break the dashboard；設計：每一週獨立判斷種類、timeline 色條的兩端）：src/core/cells.ts 新增每週判斷的純函式，`perWeekCells`、`yearViewCells`、`monthViewCells` 改用它、不再補連續週；`timelineCells` 依新規則決定兩端並裁在顯示的年份內。驗證：tests/cells.test.ts 涵蓋「A Saturday task after the expected end stays visible」「A task before the start date stays visible」「A closed project's task after its end stays visible」、timeline 兩端、「An expected end in the year 9999」（< 50 ms）；tests/months.test.ts 涵蓋月視圖兩個情境；既有測試依新規則更新並列出改動。
- [x] 1.2 單列隔離（One project's dates cannot break the dashboard；Render bar continuously in timeline view mode；設計：一列出錯不影響其他列）：src/view.ts 年視圖每列、src/month-view.ts 月視圖每列各自 try/catch，出錯的列畫名稱、空白格與 `⚠`（提示 `這個專案的日期有問題`）。驗證：測試模擬某一列計算丟出錯誤時，其他列仍畫出、該列有 `⚠`。

## 2. 文件與驗收

- [x] 2.1 文件：CHANGELOG 0.5.0 英文與中文各加一段（有日期的任務一律顯示、預計結束日期只決定紅色標示、為什麼）；README 英文與中文的年視圖與月視圖說明同步。驗證：重讀差異。
- [x] 2.2 真實資料比對與自動驗收：用維護者 vault 比對 2025、2026、2027 年的年視圖與 2026 年各月的月視圖，列出每一個改變的格子；差異只能是「原本空白、現在有任務的週」；`npm test`、`npm run lint`、`npm run build` 通過，部署到本機 vault。驗證：貼出比對結果與指令結果。
- [x] 2.3 朱騏在 Obsidian 確認：有日期但超出預計結束日期的任務（例如 12/5 那兩個）出現在年視圖與月視圖、能點開；其他專案沒有怪異的變化。驗證：朱騏在對話中確認。
