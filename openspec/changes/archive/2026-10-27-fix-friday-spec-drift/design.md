## Context

星期五佔週的規則在「Output occupied_weeks per project」與 LANGUAGE.md 的 `occupied` 都已經寫成「星期五佔自己那週，只有週六移到下一週」，程式 `taskDateToWeekLabel` 與 `computeOccupiedWeeks` 也是這樣算。同一份規格後面的「Existing date fields preserved under per-week model」是在星期五規則改版前寫的，沒有跟著更新，所以同一份規格裡兩條互相矛盾。名詞表另有兩處還用 Python 時代的檔名當例子。

## Goals / Non-Goals

**Goals:**

- 讓 dashboard-task-derived-promise 內部一致，範例的期待值跟程式實際輸出相同。
- 讓 LANGUAGE.md 只用外掛現在的名詞。

**Non-Goals:**

- 不改任何程式行為；週六規則、星期五規則、`promised_end` 的算法都維持原樣。
- 不把週六規則開放成設定，那是之後的設定頁改動。
- 不整理其他規格的用字。

## Decisions

### 以程式和較新的規則為準，修正舊範例

星期五規則是使用者後來刻意改的（LANGUAGE.md 的 `occupied` 條目在 Why 段落記錄了原因），程式與另一條規則都已採用，所以錯的是舊範例。另一個做法是把程式改回「星期五不佔週」，但那會推翻使用者的規劃習慣，因此不採用。

### 用測試固定修正後的範例

修正後的範例補一則掃描測試，證明程式本來就輸出 `["2026-W20"]`，之後若有人改壞星期五規則會被測試擋下。

## Risks / Trade-offs

- [只改文字，可能還有別處的舊說法沒被發現] → 改動前已對 openspec/specs 與 LANGUAGE.md 搜尋星期五與 Python 相關字樣，只找到這三處。
