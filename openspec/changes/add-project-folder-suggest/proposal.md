## Why

設定頁的 `Project folder` 現在只能手打資料夾路徑，例如 `Spaces/1. 🔥 Project (On)`。路徑長、有符號，打錯一個字就顯示 `Can't find this folder.`，在手機上更難打。朱騏回饋：不管電腦版還是手機版，點一下就要能抓到 Obsidian 裡的資料夾路徑。

## What Changes

- `Project folder` 欄位一點下去（取得焦點），就在欄位下方跳出 vault 裡所有資料夾的清單，跟 Obsidian 自己設定頁選資料夾的清單一樣。
- 邊打字邊篩選：不分大小寫，路徑裡任何地方含有打的字就列出來。清單照路徑排序，不列 vault 最上層（`/`）。
- 點清單裡的一個資料夾，就把路徑填進欄位並存檔，之後的流程跟手打完全一樣：400 毫秒後存檔、開著的儀表板重新掃描、`Can't find this folder.` 提示跟著更新。
- 仍然可以手打清單裡沒有的路徑，照舊顯示 `Can't find this folder.`。
- 欄位說明補一句英文（國小五年級看得懂）：可以點欄位從清單選資料夾。
- 電腦、平板、手機都一樣，用 Obsidian 內建的輸入建議元件（`AbstractInputSuggest`）。

## Non-Goals

- 不改其他設定欄位（`Projects to skip`、分類規則、行事曆）。
- 不改專案資料夾的規則：仍然只讀資料夾裡第一層的筆記，清空時仍退回 `Projects`。
- 不另做選資料夾的對話框或資料夾樹。
- 不在儀表板畫面上加選資料夾的按鈕。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dashboard-settings`: `Project folder` 欄位多了資料夾建議清單，欄位說明多一句。

## Impact

- Affected specs: dashboard-settings
- Affected code:
  - New: src/folder-suggest.ts, tests/folder-suggest.test.ts
  - Modified: src/settings-tab.ts, tests/settings-tab.test.ts, tests/stubs/obsidian.ts, README.md, README.zh-TW.md, docs/details.md, docs/details.zh-TW.md, CHANGELOG.md
