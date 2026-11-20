## Problem

上架前的獨立資安審查（Codex 只讀審查，主代理逐項重現）找到 8 個問題：

1. 行事曆裡一個寫壞的重複規則（例如每天找「2 月 30 日」），會讓行程展開永遠停不下來，Obsidian 整個卡死。已重現：超過 20 秒仍在跑。
2. 設定頁貼新連結時，會直接覆寫這個行事曆原本用的鑰匙。如果那把鑰匙是別的用途（使用者早期用舊版密鑰選擇器挑的），別的資料就被蓋掉。
3. 一則預計結束日期寫得很遠的筆記（例如 9999 年），會讓年視圖、月視圖先配置大量記憶體，再丟出錯誤，整張圖畫不出來。已重現：約 0.5 秒後丟出錯誤。這一項併進同時進行的 show-every-dated-task 修正，因為那邊會重寫同一段補週的程式。
4. 取消勾選任務時，用來移除完成日期的正規表示式遇到很長的連續空白會變成平方時間。已重現：4 萬個空白要 0.8 秒。
5. 用四個反引號開啟的程式碼區塊裡，有三個反引號的範例時，範例裡的核取方塊會被當成真的任務，可以被改寫。已重現。
6. ical.js 的全域時區登記處，透過時區元件指回整份行事曆，所以讀過的行事曆全文會一直留在記憶體，外掛卸載也清不掉。
7. 設定頁貼錯的連結會一直以明文留在輸入欄。
8. 設定的延遲存檔計時器在外掛卸載時沒有取消，卸載後仍可能寫入外掛資料，不符合 Obsidian 的資源清理規範。

## Root Cause

1. ical.js 的 `RecurIterator.next()` 對 DAILY、WEEKLY 等頻率，用一個沒有上限的迴圈找下一個符合條件的日期。外掛自己的 100,000 次上限只限制「找到幾次」，攔不到「找不到」。
2. 設計時規定「沿用這列原本的鑰匙 ID」，沒有區分 ID 是不是外掛自己建立的。
3. 「先補一段連續週」的做法，會把專案的整個期間都補成週，沒有設上限。
4. `/\s*✅\s+\d{4}-\d{2}-\d{2}/g` 開頭沒有錨點，`\s*` 會從每個空白位置重新嘗試。
5. 程式碼圍欄只記錄字元，沒有記錄長度，不符合 CommonMark。
6. 註冊時區時直接用行事曆裡的元件，元件的 `parent` 指回整份行事曆；卸載時也沒有清掉登記處裡外掛自己加的時區。
7. 連結欄是一般文字欄，驗證失敗不清空。
8. `PluginDataStore` 沒有卸載時的清理步驟。

## Proposed Solution

1. 給 ical.js 的找日期迴圈加上上限：用一個只在 `src/core/calendar.ts` 內部使用的包裝，計算每次找下一個日期時檢查了幾個候選日期，超過 200,000 個就停止這個行程，當作沒有更多次，其他行程照常。
2. 只有外掛自己建立的鑰匙（ID 以 `project-dashboard-calendar-` 開頭）才會被覆寫。這列原本用的是別的 ID 時，產生一個新的外掛 ID 存新連結，並把這列改指向新 ID，原來那把鑰匙一字不動。
3. 由 show-every-dated-task 處理（補週的範圍設上限、一列出錯不影響其他列）。
4. 改成先用線性時間找到完成日期標記，再移除它前面緊鄰的空白。
5. 照 CommonMark 判斷圍欄：記住開啟的字元與長度，關閉時字元相同、長度至少一樣，後面只能有空白。
6. 註冊時區時用一份斷開與原行事曆連結的複本，外掛卸載時移除外掛自己登記的時區；單一行事曆回應超過 20 MB 時當作讀不到，原因 `行事曆太大`。
7. 連結欄改成密碼欄（顯示圓點），關閉拼字檢查與自動完成；驗證失敗時清空欄位，錯誤訊息提醒重新貼上。
8. `PluginDataStore` 新增 `dispose()`：卸載時把還沒存的設定立刻存一次，之後不再存檔；`main.ts` 的 `onunload` 呼叫它。

## Non-Goals

- 不把行事曆解析移到 Web Worker（改動太大，第 1 項的上限已經讓它不會卡死）。
- 不限制行事曆網址指向內網位址（網址是使用者自己設定的，不是外來輸入）。
- 不處理開發工具（obsidian 型別套件）的 15 個中等警告，它們不會打包進外掛。

## Success Criteria

- 規格「Guards against malformed calendars and notes」的每個情境都有測試，而且在修正前會失敗、修正後通過。
- 寫壞的重複規則在 1 秒內結束，其他行程照常顯示。
- 4 萬個空白的任務行，取消勾選在 50 ms 內完成。
- 四個反引號圍欄裡的範例不會被當成任務。
- 外掛卸載後，時區登記處不再留有行事曆內容，也不會再寫入外掛資料。
- `npm test`、`npm run lint`、`npm run build` 通過；主代理重跑重現腳本確認全部解決。

## Impact

- Affected specs: dashboard-robustness（新增），並修正 add-calendar-row 裡連結欄沿用鑰匙 ID 的文字
- Affected code:
  - Modified: src/core/calendar.ts, src/calendar-store.ts, src/settings-tab.ts, src/core/task-lines.ts, src/core/plugin-data-store.ts, src/main.ts, tests/calendar.test.ts, tests/calendar-store.test.ts, tests/settings-tab.test.ts, tests/task-lines.test.ts, tests/plugin-data-store.test.ts, CHANGELOG.md
