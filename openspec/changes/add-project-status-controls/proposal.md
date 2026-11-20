## Why

朱騏有些專案做到一半就擱著，沒有要推進，他會在專案筆記的檔名前面加 ⏳。可是儀表板雖然認得 ⏳，卻把它當成進行中照樣顯示：沒做的週畫虛線、過了預計結束日期照樣標紅。這些專案佔版面，也干擾判斷這週要做什麼。另外，現在改狀態只能到筆記列表手動改檔名開頭的符號，在儀表板上規劃時要切出去，很不順手。

## What Changes

- 檔名開頭有 ⏳ 的專案（暫停）預設不顯示。控制列多一個勾選框 `顯示暫停（<數量>）`：只在有暫停的專案時出現，括號裡的數量一直提醒還有幾個被擱著；勾起來就顯示，畫面比進行中的淡。年視圖和月視圖都適用。
- 「編輯分類」勾選框改名為 `編輯分類與狀態`。勾起來時，每一列除了分類選單，還多一個狀態選單：`🚧 進行中`、`⏳ 暫停`、`✅ 完成`、`❌ 取消`。選了之後，外掛透過 Obsidian 的檔案管理把檔名開頭的狀態符號換掉，其他筆記的連結照 Obsidian 的設定自動更新；檔名其他部分不動，手動指定的分類也保留。
- 同名的筆記已經存在時不改名，並顯示提示。
- 併進還沒發布的 0.5.0，README、CHANGELOG、名詞表同步更新。

## Non-Goals

- 不改用 frontmatter 或外掛資料記錄狀態；檔名開頭的符號仍是唯一的狀態來源。
- 不記住「顯示暫停」「顯示已結案」的勾選狀態（和現在一樣，每次打開都是不勾）。
- 不批次改多個專案的狀態。
- 改成完成時不自動填寫實際結束日期。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `dashboard-status-controls`: 暫停的專案預設隱藏、`顯示暫停（<數量>）` 勾選框、暫停專案的淡化樣式；「單一 closed 切換控制」的情境改成 pending 不再預設顯示。
- `dashboard-category-override`: 編輯模式的勾選框改名為 `編輯分類與狀態`，編輯模式多一個狀態選單，選了會改檔名開頭的狀態符號。

## Impact

- Affected specs: dashboard-status-controls、dashboard-category-override
- Affected code:
  - Modified: src/core/cells.ts, src/core/scan.ts, src/view.ts, src/project-column.ts, styles.css, tests/cells.test.ts, tests/scan.test.ts, README.md, CHANGELOG.md, openspec/LANGUAGE.md
