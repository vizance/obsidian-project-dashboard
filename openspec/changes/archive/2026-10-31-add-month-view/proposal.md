## Why

年視圖一格只畫顏色，要看某週排了什麼得一格一格點開浮窗。朱騏每週五規劃下週時，真正用的是 Google 試算表的「月平行互見表」：一列一個專案、一欄一週，格子裡直接寫任務，一眼看出這個月每個專案在動什麼、哪一週會爆。這張表要手動從專案筆記抄，不更新就跟筆記脫節。月視圖把同一份筆記資料放大到「這個月的 4～5 週」，格子直接列出任務，取代手抄的那張表。

這是第二階段三個改動的第二個；行事曆列是下一個改動。

## What Changes

- 儀表板多一個「年／月」切換：月視圖顯示一個月的 4～5 週，可以切到上一個月、下一個月、回到本月；按 `M` 也能切換年／月。打開月視圖時顯示今天這週所屬的月份。記住上次停在年視圖還是月視圖。
- 週的月份歸屬改成「週一落在哪個月」，和朱騏的月平行互見表一致：2026 年 10 月是 W41～W44、11 月 W45～W49、12 月 W50～W53。年視圖表頭的月份與季也改用同一條規則，兩邊才對得上（例如 W40 從 10 月移到 9 月）。
- 月視圖的列和年視圖相同（同樣的分類分組、排序、`顯示已結案`、`編輯分類`），欄是專案名稱、4～5 個週欄，以及每個專案一欄「還沒排」的數量。
- 每個週格子列出那週的任務文字，週的歸屬用既有規則與目前設定：完成的任務打勾、變灰；週已經過了還沒完成的任務標紅；格子的底色沿用年視圖同一週的狀態。
- 點月視圖的格子打開現在的週浮窗，所有編輯功能照舊；改完之後月視圖原地重繪，浮窗留在同一週。
- 點「還沒排」的數量打開浮窗，列出這個專案還沒排日期的任務，每個任務可以直接排進這個月的某一週，或跳到筆記那一行（朱騏手動驗收時加的需求）。
- `T` 在月視圖不作用；說明面板補上 `M` 與月視圖的圖示說明。
- 版本升為 0.4.0，README、CHANGELOG、名詞表同步更新。

## Non-Goals

- 行事曆列（General 列，下一個改動）。
- 番茄鐘加總、常態列、`>` 延後痕跡、拖曳換週。
- 在格子裡直接打字或勾選（一律透過週浮窗）。
- 在還沒排浮窗裡勾完成、移週或新增任務。
- 年視圖的 timeline 模式套用到月視圖。

## Capabilities

### New Capabilities

- `dashboard-month-view`: 週的月份歸屬規則、年／月切換、月視圖的版面、格子裡的任務文字與狀態、從格子打開週浮窗、「還沒排」欄與還沒排浮窗。

### Modified Capabilities

- `dashboard-keyboard-shortcuts`: `T` 在月視圖不作用；說明面板列出 `M` 與月視圖的圖示說明。
- `dashboard-obsidian-plugin`: 介面偏好多一個記住年／月的鍵；`M` 加進只在儀表板分頁作用的快捷鍵；月視圖列入儀表板依循的規格。
- `dashboard-note-sync`: 重繪時保留目前是年視圖或月視圖、月視圖顯示的月份，以及月視圖中開著的週浮窗與還沒排浮窗。
- `dashboard-sort-modes`: 控制列除了兩個勾選框，也放「年／月」切換與月份導覽，仍然沒有任何排序控制項。
- `dashboard-layout-spacing`: 32px 固定週寬只限年視圖。
- `dashboard-resizable-proj-col`: 拖拉左欄時年視圖週寬不變，月視圖的週欄平分剩下的寬度。
- `dashboard-week-popover`: per-week／timeline 的點擊規則只限年視圖；月視圖的格子一律打開可編輯的浮窗。
- `dashboard-gantt-rendering`: timeline 的連續色條只出現在年視圖。

## Impact

- Affected specs: dashboard-month-view（新增）、dashboard-keyboard-shortcuts、dashboard-obsidian-plugin、dashboard-note-sync、dashboard-sort-modes、dashboard-layout-spacing、dashboard-resizable-proj-col、dashboard-week-popover、dashboard-gantt-rendering
- Affected code:
  - New: src/month-view.ts, src/core/months.ts, tests/months.test.ts
  - Modified: src/view.ts, src/week-popover.ts, src/core/weeks.ts, src/core/cells.ts, src/core/prefs.ts, styles.css, tests/weeks.test.ts, tests/cells.test.ts, tests/prefs.test.ts, README.md, CHANGELOG.md, openspec/LANGUAGE.md, manifest.json, package.json, package-lock.json
