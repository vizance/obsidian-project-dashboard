## 1. 修正

- [x] 1.1 重複規則與時區（Malformed recurrence rules cannot freeze the dashboard；Calendar data is released and bounded；設計：重複規則：在 ical.js 找日期的迴圈裡計數、時區與回應大小）：src/core/calendar.ts 在 ical.js 找下一個日期的迴圈加 200,000 次上限並在 `collectRecurring` 接住；註冊時區用沒有 parent 的複本並記下自己註冊的 TZID，提供移除函式；src/calendar-store.ts 在解析前檢查 20 MB、`dispose()` 時移除時區。驗證：tests/calendar.test.ts 的「An impossible daily rule」在 1 秒內完成且其他行程照常；tests/calendar-store.test.ts 涵蓋 `行事曆太大` 與卸載後時區登記處沒有外掛的時區。
- [x] 1.2 鑰匙與連結欄（The plugin only overwrites its own secrets；The link field hides and clears rejected links；設計：鑰匙：只覆寫外掛自己建立的、連結欄：密碼欄、失敗即清空）：src/settings-tab.ts 只沿用 `project-dashboard-calendar-` 開頭的 ID，其他 ID 改用新 ID；連結欄改密碼欄、關拼字與自動完成、失敗清空。驗證：tests/settings-tab.test.ts 涵蓋「A secret chosen with the old picker stays untouched」「A rejected link does not stay on screen」。
- [x] 1.3 完成標記與圍欄（Untrusted text is processed in linear time；Fenced code blocks follow CommonMark；設計：完成標記：線性尋找再往前去空白、程式碼圍欄：照 CommonMark 記住字元與長度）：src/core/task-lines.ts 改寫 `toggleDoneLine` 的移除方式與圍欄判斷。驗證：tests/task-lines.test.ts 涵蓋「A long run of spaces」（< 50 ms 且結果正確）與「A three-backtick example inside a four-backtick block」，既有任務測試全過。
- [x] 1.4 卸載時先存再停（Nothing is saved after the plugin unloads；設計：卸載：先存再停）：src/core/plugin-data-store.ts 新增 `dispose()`，src/main.ts 的 `onunload` 呼叫。驗證：tests/plugin-data-store.test.ts 涵蓋「Unloading during the save delay」。

## 2. 文件與驗收

- [x] 2.1 規格與文件：把 `add-calendar-row` 規格裡設定頁「沿用這列原本的鑰匙 ID」改成只沿用外掛自己的 ID；CHANGELOG 0.5.0 英文與中文各加一段資安修正說明（白話、說明原因）。驗證：重讀差異。
- [x] 2.2 自動驗收：`npm test`、`npm run lint`、`npm run build` 通過；主代理重跑四個重現腳本確認全部解決；部署到本機 vault。驗證：貼出結果。
