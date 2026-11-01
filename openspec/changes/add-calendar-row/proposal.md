## Why

朱騏的月平行互見表最上面有一列 General，放「已經在行事曆上、不能隨便移動的事」。現在每週五規劃時，他要打開 Google 或 Apple 行事曆，把下週的行程一筆一筆手抄進表格。月視圖已經取代了表格的專案部分，只剩行事曆這一列還要手填。讓儀表板自己讀行事曆，月視圖最上面就能直接看到每週的固定行程，專案任務跟行程放在同一張表上，才看得出「這週排得下嗎」。

這是第二階段三個改動的最後一個。

## What Changes

- 設定頁多一個 `Calendars` 區塊，可以加好幾個行事曆，每個有自己的名字。行事曆的私密連結（iCal 網址）存在 Obsidian 的密鑰儲存區，外掛資料只記名字和鑰匙的 ID，連結本身不寫進外掛資料。
- 外掛透過網路讀取行事曆，只讀不寫。讀取時機有四個：打開儀表板、按 General 列的 `↻`、執行指令 `Refresh calendars`、行事曆設定改變。讀到的行程只放在記憶體。
- 月視圖最上面多一列 General，至少設定一個行事曆才會出現。每個週格子列出那週的行程，例如 `11/6（五）13:30 讀書會`：
  - 整天的行程只寫日期，跨天的行程寫起訖。
  - 重複行程展開到每一週。
  - 取消的行程不顯示。
  - 週六的行程放在當週，不套用任務的週六規則。
- General 列的名稱格顯示讀取中、上次讀取時間，以及讀不到的行事曆。
- 年視圖不放行程。
- 新增 ical.js（MPL-2.0）解讀 iCal。`main.js` 開頭與 README 註明授權和原始碼位置；README 依 Obsidian 規定說明外掛會連網、連到哪裡、做什麼。
- 版本升為 0.5.0。

## Capabilities

### New Capabilities

- `dashboard-calendar-row`: 行事曆連結的保管、讀取時機與合併、iCal 解讀與重複行程展開、行程對應到週、行程文字、General 列的顯示與狀態、`Refresh calendars` 指令、連網範圍與第三方授權說明。

### Modified Capabilities

- `dashboard-settings`: 外掛資料的 `settings` 多一個 `calendars` 欄位；設定頁多一個 `Calendars` 區塊。
- `dashboard-month-view`: 月視圖版面在專案列上方多一列 General；「格子列出任務」限定在專案列。
- `dashboard-note-sync`: 行事曆資料更新造成的重繪也保留畫面狀態。
- `dashboard-obsidian-plugin`: 儀表板依循的規格加上 `dashboard-calendar-row`。
- `dashboard-keyboard-shortcuts`: 說明面板的月視圖區塊加一行 General 列的說明。

## Impact

- Affected specs: dashboard-calendar-row（新增）、dashboard-settings、dashboard-month-view、dashboard-note-sync、dashboard-obsidian-plugin、dashboard-keyboard-shortcuts
- Affected code:
  - New: src/core/calendar.ts, src/calendar-store.ts, tests/calendar.test.ts, tests/calendar-store.test.ts
  - Modified: src/core/settings.ts, src/settings-tab.ts, src/main.ts, src/month-view.ts, src/view.ts, styles.css, esbuild.config.mjs, tests/settings.test.ts, package.json, package-lock.json, manifest.json, README.md, CHANGELOG.md, AGENTS.md, openspec/LANGUAGE.md
- Dependencies: ical.js 2.2.1（MPL-2.0），打包進 `main.js`，外掛檔案約從 62 KB 變成 140 KB。
- Network: 外掛第一次會連網，只連使用者自己設定的行事曆連結。
