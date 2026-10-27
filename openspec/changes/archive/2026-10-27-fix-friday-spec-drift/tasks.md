## 1. 規格與程式對齊

- [x] 1.1 星期五範例有測試固定（Existing date fields preserved under per-week model；設計：以程式和較新的規則為準，修正舊範例、用測試固定修正後的範例）：唯一任務日期是 2026-05-15（星期五）的專案，掃描後 `promised_end` 是 `2026-05-15`、`occupied_weeks` 是 `["2026-W20"]`。驗證：tests/scan.test.ts 新增這則測試，`npm test` 全數通過，且不需要改任何 src/ 程式。
- [x] 1.2 名詞表不再提舊版 Python 掃描程式：openspec/LANGUAGE.md 的 `tentative` 與 `closed` 兩條「Avoid」改用掃描器與專案資料的說法，意思不變。驗證：`grep -n "scan_obsidian\|projects\.json" openspec/LANGUAGE.md` 沒有結果，並重讀兩條確認原本要避免的用法都還在。

## 2. 收尾

- [x] 2.1 變更通過檢查並推上 GitHub：`spectra validate fix-friday-spec-drift` 通過、`npm run lint` 0 錯誤，依 AGENTS.md 的隱私檢查指令確認追蹤中的檔案沒有命中，提交後推上 GitHub。驗證：貼出各指令結果與推送結果。
