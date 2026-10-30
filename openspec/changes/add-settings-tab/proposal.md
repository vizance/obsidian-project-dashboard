## Why

專案資料夾、分類關鍵字、手動分類、不列入的專案，目前都寫在建置時才讀的 `personal-rules.local.ts`。從 GitHub 下載 release 的人只能用預設的 `Projects` 資料夾和範例關鍵字，想改就得自己改原始碼重新建置；2027 年 1 月實戰營的學員不可能這樣用。另外「排進某週寫星期幾」（固定星期五）和「週六算下一週」是維護者的個人習慣，對別人不一定成立，之前就決定兩條要一起開放。第二階段的月視圖與行事曆列也需要放新設定的地方，所以設定頁要先做。

## What Changes

- 新增 Obsidian 設定頁（Settings → Project Dashboard），文字用繁體中文，分三區：
  - 專案筆記：專案資料夾、不列入的專案（一行一個名稱片段）。
  - 分類：一份有順序的分類規則清單（名稱包含某段文字 → 某個分類，由上往下第一個符合的生效），可新增、刪除、上移、下移。
  - 日期規則：「排進某週時寫星期幾」（星期一到星期日，預設星期五）、「週六的任務算到下一週」（開關，預設關）。
- 設定存在 vault 裡的外掛資料，與既有的手動分類放在同一份資料；任何一邊存檔都不會蓋掉另一邊。改設定後儀表板立即重新掃描並重繪，開著的週浮窗照舊留在原本那一週；在其他裝置改的設定經 Obsidian Sync 同步過來時也會重新載入，並蓋過本機還沒存的修改。
- 原本的「手動分類片段」與「分類關鍵字」合併成同一份分類規則清單，手動片段排在前面，分類結果與現在相同。
- 週六規則與排程日期改成讀設定：週六規則開啟時週六的任務算到下一週（現在的行為），關閉時算在當週；排程日期一律落在挑選的那一週，選星期六且週六規則開啟時寫前一個週六。年視圖、浮窗、提示文字都依設定顯示。
- 兩份重複的週六規則程式合成一份。
- 移除建置時的個人規則機制：`personal-rules.local.ts`、`personal-rules.example.ts`、`ensure-local-rules.mjs` 與相關 npm 腳本、測試別名。release 不再因建置的電腦不同而內容不同。
- 維護者目前的個人規則一次搬進 vault 的外掛資料，搬完逐筆確認儀表板顯示與搬家前相同。
- 版本升為 0.3.0，README、CHANGELOG、AGENTS.md、名詞表同步更新。

## Capabilities

### New Capabilities

- `dashboard-settings`: 設定頁的欄位、預設值、資料檢查、存檔與即時套用，以及外部同步時重新載入。

### Modified Capabilities

- `dashboard-obsidian-plugin`: 專案資料夾與不列入清單改讀設定；外掛資料同時保存設定與手動分類；分類順序改成「精確名稱覆寫 → 分類規則清單 → 其他」。
- `dashboard-category-override`: 分類優先順序改成精確名稱覆寫優先，其次是分類規則清單。
- `dashboard-note-sync`: 判斷哪些檔案變動要重新掃描時，用設定中的專案資料夾；設定變更與外部同步造成的重繪，同樣保留捲動位置與開著的週浮窗。
- `dashboard-task-derived-promise`: 週六任務是否算到下一週改由設定決定。
- `dashboard-gantt-rendering`: 提示文字只在週六規則開啟時標註「週六算下一週」。
- `dashboard-task-editing`: 浮窗的週對應與週六標籤依設定；排程日期依設定的星期幾與週六規則推算。

## Impact

- Affected specs: dashboard-settings（新增）、dashboard-obsidian-plugin、dashboard-category-override、dashboard-note-sync、dashboard-task-derived-promise、dashboard-gantt-rendering、dashboard-task-editing
- Affected code:
  - New: src/core/settings.ts, src/core/plugin-data-store.ts, src/settings-tab.ts, tests/settings.test.ts, tests/plugin-data-store.test.ts
  - Modified: src/main.ts, src/view.ts, src/vault-source.ts, src/week-popover.ts, src/core/config.ts, src/core/scan.ts, src/core/cells.ts, src/core/task-lines.ts, src/core/weeks.ts, tests/scan.test.ts, tests/cells.test.ts, tests/task-lines.test.ts, tests/weeks.test.ts, tests/vault-source.test.ts, tests/sync-rules.test.ts, package.json, package-lock.json, manifest.json, vitest.config.ts, eslint.config.mjs, README.md, CHANGELOG.md, AGENTS.md, openspec/LANGUAGE.md
  - Removed: src/core/personal-rules.example.ts, scripts/ensure-local-rules.mjs
- 維護者本機：vault 內本外掛的資料檔先備份，再寫入搬過去的設定；git 忽略的 `personal-rules.local.ts` 在確認搬家正確後移到垃圾桶。同步這個 vault 的其他電腦要一起更新到 0.3.0 或先停用本外掛，否則舊版存分類時會把設定刪掉。
