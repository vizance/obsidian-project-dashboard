## Why

儀表板現在只能看、不能改。週五規劃下週時，使用者在週浮窗裡看到任務，還是得切回筆記、找到那一行、手打日期；沒寫日期的任務在儀表板上完全看不到，偏偏它們就是要挑進下週的候選。把最常用的五個動作搬進週浮窗，儀表板才會變成規劃時真的會打開的地方。

## What Changes

- 週浮窗從唯讀文字改成任務清單。每個任務一行，可以直接勾完成、按 ◀ ▶ 移到前一週或下一週、按 ↗ 在右側分割開啟筆記並跳到那一行。
- 浮窗底部新增兩個入口：從這則筆記「還沒排日期的任務」挑一個排進這週，或直接新增一個任務到這週。
- 排進某週時寫那週星期五的日期；換週時保留原本星期幾，日期加減 7 天。第一版寫死在同一個地方，之後與「週六算下一週」一起開放成設定。
- 掃描器多輸出每則筆記的「任務行」：行號、原始文字、是否為核取方塊、是否完成、`📅` 與 `✅` 日期、是否為重複任務。既有欄位的值與計算方式不變。
- 所有改筆記的動作都交給同一個寫入模組。它在寫入當下比對那一行的文字，跟掃描時讀到的不一樣就不寫，並提示使用者重新看一次。
- 逐週模式下，沒有任務的虛線週格與「整條虛線」的專案列也能點開浮窗，這樣才能把第一個任務排進空的那一週。
- 筆記存檔後的自動重繪，改成在同一個專案、同一週重新打開浮窗，連續勾好幾個任務時不用每次重點。

## Capabilities

### New Capabilities

- `dashboard-task-editing`: 週浮窗裡的任務編輯，包含任務行掃描、勾完成、換週、排進還沒排日期的任務、新增任務、跳到筆記那一行，以及集中寫入與寫入前的內容比對。

### Modified Capabilities

- `dashboard-week-popover`: 浮窗內容從複製格子的 `title` 文字改成可操作的任務清單；逐週模式下可點開的格子多了虛線週格與整條虛線；在浮窗內捲動不再關閉浮窗。
- `dashboard-note-sync`: 自動重繪後，原本開著的浮窗改成在同一個專案與同一週重新打開，那格不能再開浮窗時才關閉；新增任務的輸入框也會保留，方便連續新增。
- `dashboard-gantt-rendering`: 完成的判斷改成核取方塊打勾，或 `✅` 後面接日期；任務文字裡連到已完成筆記的 `[[✅ …]]` 不再讓任務算完成（原本會把那一週畫成已完成）。規格範例裡的人名改成中性寫法。
- `dashboard-obsidian-plugin`: 焦點在勾選框上時，`Escape` 仍然可以關閉浮窗；只有在打字的欄位裡才不攔截。

## Impact

- Affected specs: `dashboard-task-editing`（新增）、`dashboard-week-popover`、`dashboard-note-sync`
- Affected code:
  - New:
    - src/core/task-lines.ts
    - src/task-writer.ts
    - src/week-popover.ts
    - tests/task-lines.test.ts
    - tests/task-writer.test.ts
  - Modified:
    - src/core/scan.ts
    - src/core/weeks.ts
    - src/core/cells.ts
    - src/view.ts
    - styles.css
    - tests/stubs/obsidian.ts
    - tests/scan.test.ts
    - tests/weeks.test.ts
    - tests/cells.test.ts
    - openspec/LANGUAGE.md
    - README.md
    - CHANGELOG.md
    - manifest.json
    - package.json
    - package-lock.json
- 相依：使用 Obsidian 內建的 `Vault.process` 做讀改寫，不新增套件；`minAppVersion` 維持不變。
