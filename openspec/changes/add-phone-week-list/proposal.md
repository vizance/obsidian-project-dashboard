## Why

外掛目前標成只能在電腦上用（`isDesktopOnly: true`）。朱騏出門時想用手機看「這週和接下來幾週要做什麼」，順手打勾或改日期。可是現在的年視圖約 1,950 像素寬，月視圖的名稱欄就有 280 像素，手機大約 390 像素寬，兩種畫面都放不下。拖拉排序、拖拉欄寬只能用滑鼠，⚠ 的原因要靠滑鼠停在上面才看得到，筆記也開在手機沒有的右側分割畫面。

## What Changes

- 外掛開放手機與平板安裝：`manifest.json` 的 `isDesktopOnly` 改成 `false`。
- 只有手機（由 Obsidian 判斷是不是手機，不看視窗寬度）換成新的「手機週清單」。平板與電腦維持現在的年視圖、月視圖。
- 手機週清單由上往下列出本週與後面 3 週，共 4 週。每週照專案分組列出那週的任務：
  - 週的分法、星期六規則、任務歸週，沿用月視圖同一套計算。專案順序跟儀表板的列順序相同。
  - 完成的任務打勾、變灰；週已經過了還沒做的標紅。沒有任務的週寫一行灰字 `這週沒有任務`。
  - 第 5 週以後的任務不顯示。
- 手機上能做三件事，按鈕直接放在每一行，不彈出週浮窗：
  - 打勾或取消。
  - 用 `◀` `▶` 把任務移一週。
  - 點專案名稱打開筆記，按 Obsidian 的返回回到儀表板。

  寫回筆記沿用電腦版同一套寫入方式與保護規則。
- 最上面一列 `之前還沒做（n）`，收著週已經過了、還沒完成的任務，點一下才展開：
  - 只算畫面上顯示的專案。
  - 這一區的任務不放 `◀` `▶`，改放 `排到本週`。按一下就把日期改成本週的排程日期，寫星期幾照 `Which day to write` 設定，預設週五。
  - n 是 0 時，整列不出現。
- 手機上不讀行事曆、不連網路。設定頁的 Calendars 區塊在手機上只顯示一句說明。
- README 兩種語言都加上手機版的說明與截圖，並刪掉「Desktop only」。

## Non-Goals

範圍外的項目與不採用的做法記在 design.md。

## Capabilities

### New Capabilities

- `dashboard-phone-week-list`: 手機上的儀表板。涵蓋手機版面的判斷、4 週清單、`之前還沒做` 區塊、每一行的編輯動作、在手機上開啟筆記，以及手機上收起來的功能（行事曆、說明面板、快捷鍵、設定頁的 Calendars 區塊）。

### Modified Capabilities

- `dashboard-obsidian-plugin`：`manifest.json` 改宣告 `isDesktopOnly: false`。README 的段落多一節手機版，並說明平板上的限制。
- `dashboard-calendar-row`：讀取行事曆的時機加上例外：在手機上，任何時機都不讀行事曆，也不註冊 `Refresh calendars` 指令。

## Impact

- Affected specs: dashboard-phone-week-list（新增）、dashboard-obsidian-plugin、dashboard-calendar-row
- Affected code:
  - New: src/core/phone-weeks.ts, src/phone-week-list.ts, tests/phone-weeks.test.ts, tests/phone-week-list.test.ts, docs/images/phone-week-list.png
  - Modified: manifest.json, src/view.ts, src/main.ts, src/settings-tab.ts, styles.css, tests/stubs/obsidian.ts, scripts/screenshots/capture.py, scripts/screenshots/shim/obsidian.ts, scripts/screenshots/demo/main.ts, README.md, README.zh-TW.md, docs/details.md, docs/details.zh-TW.md, CHANGELOG.md
