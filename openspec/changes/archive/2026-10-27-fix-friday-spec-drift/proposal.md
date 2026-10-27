## Why

「星期五的任務算本週」早就是程式與規格的正式規則，但 dashboard-task-derived-promise 裡「既有日期欄位不受影響」這條還留著舊說法：說星期五的任務不佔週，範例也寫 `occupied_weeks` 是空的。名詞表 LANGUAGE.md 也還提到舊版 Python 掃描程式的檔名。這兩處跟現在的外掛對不上，讀規格的人會被誤導，下一個改動也可能照著錯的範例實作。

## What Changes

- 改寫 dashboard-task-derived-promise 的「Existing date fields preserved under per-week model」：說明文字改成只有週六的任務會被移到下一週、`promised_end` 仍取原始日期；星期五範例改成 `📅 2026-05-15` 佔自己那週 `2026-W20`。
- 補一則測試固定這個範例，證明程式本來就是這樣運作。
- LANGUAGE.md 的 `tentative` 與 `closed` 兩條「Avoid」改用外掛現在的說法（掃描器與專案資料），拿掉 `scan_obsidian.py`、`projects.json`。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dashboard-task-derived-promise`: 「既有日期欄位不受影響」的說明與星期五範例改成符合現行的星期五佔週規則。

## Impact

- 規格：openspec/specs/dashboard-task-derived-promise/spec.md（封存時套用）、openspec/LANGUAGE.md。
- 測試：tests/scan.test.ts 新增一則。
- 程式、建置產物、外掛行為都不變，不需要重新部署。
