## Context

設定頁的 `Project folder` 是一般的文字欄位（`Setting.addText`），值改了就呼叫 `patch({ projectFolder })`，再由外掛資料元件延遲 400 毫秒存檔、通知開著的儀表板重新掃描；`updateFolderHint` 用 `vault.getAbstractFileByPath` 判斷要不要顯示 `Can't find this folder.`。

Obsidian 1.4.10 起提供 `AbstractInputSuggest<T>`，可以掛在任何 `<input>` 上做輸入建議，Obsidian 自己的設定頁選資料夾也是這種清單，電腦、平板、手機都能用。它預設一次最多畫 100 個建議（`limit`）。`vault.getAllFolders(includeRoot)` 從 1.6.6 起可以用。外掛的 `minAppVersion` 是 1.11.7，兩者都可以直接用。

介面簡化檢查的四題：

1. **誰、在做什麼事的途中？** 第一次設定外掛的人，要告訴外掛專案筆記放在哪個資料夾。
2. **是主要工作還是附帶的事？** 主要工作。所以直接長在原本的欄位上，不另外放按鈕。
3. **能不能併進既有的控制項？** 可以，清單就是欄位本身的行為，畫面上沒有多出任何東西，只多一句說明。
4. **多久用一次？** 很少，通常只在第一次設定或搬資料夾時用。所以不做資料夾樹或對話框，用 Obsidian 使用者已經熟悉的清單。

## Goals / Non-Goals

**Goals:**

- 點一下 `Project folder` 就看到 vault 裡全部的資料夾，點一個就設定好，不用手打。
- 打字可以縮小清單。
- 電腦、平板、手機行為一樣。

**Non-Goals:**

- 其他設定欄位的建議清單。
- 資料夾樹、選資料夾的對話框、儀表板上的選資料夾按鈕。
- 改變專案資料夾的讀取規則或預設值。

## Decisions

### 篩選與排序放在純函式

新增 `src/folder-suggest.ts`，匯出純函式 `folderSuggestions(paths: string[], query: string): string[]`：

- 去掉空字串與 `/`（vault 最上層）。
- `query` 去掉前後空白；空的話回傳全部，否則只留路徑裡任何地方含有它的（不分大小寫）。
- 照路徑排序：`a.localeCompare(b, undefined, { sensitivity: 'base' })`，相同時再用一般比較，讓結果固定。

這樣排序、篩選與排除最上層都能在單元測試裡鎖住，不用模擬 Obsidian 的清單。

### 清單元件掛在原本的文字欄位上

同一個檔案匯出 `ProjectFolderSuggest extends AbstractInputSuggest<string>`：

- 建構時拿 `app`、文字欄位的 `inputEl`，以及選到資料夾時要呼叫的 `onPick(path)`。
- `getSuggestions(query)`：用 `app.vault.getAllFolders(false)` 取出路徑，交給 `folderSuggestions`。欄位剛取得焦點、使用者還沒打字時傳空字串，所以點下去看到全部資料夾；使用者在欄位裡打字或刪字之後才用欄位的文字篩選；欄位失去焦點（`blur`）時重設，下次點下去又是全部。「打過字」用 `beforeinput` 事件記下：Obsidian 的清單在 `input` 事件裡就會重新要建議，`beforeinput` 一定比它早，第一個字就能篩選，不受監聽器註冊順序影響。
- `renderSuggestion(path, el)`：只寫路徑文字。
- `selectSuggestion(path)`：`setValue(path)`、`close()`，再呼叫 `onPick(path)`。

設定頁的 `buildProjectNotesSection` 在 `addText` 裡建立這個元件，`onPick` 做的事和欄位的 `onChange` 相同：`patch({ projectFolder: path })` 與 `updateFolderHint`。這樣存檔、重新掃描、提示的規則只有一份。

替代方案：

- 自己畫下拉選單：要自己處理位置、捲動、鍵盤、手機鍵盤遮住的問題，Obsidian 的元件都已經處理好，所以不採用。
- 用 `setValue` 之後發一個 `input` 事件，讓欄位自己的 `onChange` 存檔：會讓建議清單以為使用者打了字而重新打開，所以改成直接呼叫 `onPick`。

### 測試替身

`tests/stubs/obsidian.ts` 加一個最小的 `AbstractInputSuggest`：記下 `app` 與 `inputEl`，提供 `setValue`（改 `inputEl.value`）、`getValue`、`close`、`open`、`limit`，讓測試可以直接呼叫 `getSuggestions` 與 `selectSuggestion`，確認選到後的存檔與提示。替身的 vault 要提供 `getAllFolders`。

## Implementation Contract

**可以觀察到的行為：**

- 點 `Project folder`：清單列出 vault 全部資料夾（不含 `/`），照路徑排序。
- 打 `proj`：只剩路徑裡含 `proj` 的資料夾（不分大小寫）。
- 點一個資料夾：欄位變成那個路徑、清單關閉、400 毫秒後存檔、開著的儀表板重新掃描、`Can't find this folder.` 依新路徑更新。
- 欄位說明是 `The folder where your project notes live. Only notes right inside this folder are used. Notes in folders inside it are skipped. Tap or click the box to pick a folder from a list.`

**介面與資料形狀：**

- `src/folder-suggest.ts` 匯出 `folderSuggestions(paths, query): string[]` 與 `ProjectFolderSuggest`。
- `projectFolder` 的存法、預設值與檢查規則不變。

**失敗時：**

- vault 裡沒有任何資料夾：清單是空的，欄位照常可以手打。
- 打的字對不到任何資料夾：清單是空的，照舊顯示 `Can't find this folder.`。

**驗收方式：**

- `tests/folder-suggest.test.ts`：`folderSuggestions` 的排除 `/`、空查詢回傳全部、不分大小寫的篩選、排序；`ProjectFolderSuggest` 點下去（還沒打字）給全部、打字後篩選、失去焦點後重設、選到後呼叫 `onPick` 並關閉。
- `tests/settings-tab.test.ts`：欄位說明的新文字；從清單選 `Work/Projects` 之後存進設定、提示消失。
- 既有測試、`npm run lint`、`npm run build` 通過。
- 朱騏在電腦與手機上各點一次 `Project folder`，確認清單出現、可以選。

**範圍：**

- 範圍內：`Project folder` 的建議清單與說明、相關測試、README 與 details 提到這個欄位的地方、CHANGELOG。
- 範圍外：Non-Goals 列出的全部項目。

## Risks / Trade-offs

- [Obsidian 的清單在欄位取得焦點時不一定自己打開] → 實機測試時確認；不會自己打開的話，改成在 `focus` 時呼叫清單元件的開啟方式，並補測試。
- [資料夾很多時，一次最多畫 100 個] → 用 Obsidian 預設的 `limit`，打字縮小範圍就找得到。
- [自動測試跑不了真的 Obsidian 清單] → 篩選與選到後的行為用單元測試鎖住，清單外觀與點擊由朱騏實測。
