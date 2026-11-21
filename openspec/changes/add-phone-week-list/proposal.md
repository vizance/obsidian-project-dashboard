## Why

外掛目前標成只能在電腦上用（`isDesktopOnly: true`）。朱騏出門時想用手機看「這週和接下來幾週要做什麼」，順手打勾或改日期。可是現在的年視圖約 1,950 像素寬，月視圖的名稱欄就有 280 像素，手機大約 390 像素寬，兩種畫面都放不下。拖拉排序、拖拉欄寬只能用滑鼠，⚠ 的原因要靠滑鼠停在上面才看得到，筆記也開在手機沒有的右側分割畫面。

第一版（0.6.0-beta.1）在手機上改成由上往下的 4 週清單。朱騏在手機上實際用過後回饋：「使用上其實好像還是不太好」「有一點沒有太大的意義」。他每週五規劃下週時用的是自己的「月平行互見表」：一列一個專案、一欄一週，格子裡直接寫任務，一眼看出每個專案在動什麼、哪一週會爆。週清單把這張表拆成一長條，正好失去了「平行」這件事。所以手機改用月視圖，拿掉週清單。

第二版（0.6.0-beta.2）的手機月視圖，朱騏用過後說「目前用起來還不錯」，再加三個調整：打開時看到的是本月開頭的週，今天那週要往左滑才看得到；名稱欄 96 像素放 `P-20260302 範例企業內訓規劃` 會折成 3 到 4 行，列被撐高；還有他的原話「因為現在週數都在最上面，用手機看的時候，如果滑到下面，就會不知道這個週數對應到的任務是哪些。所以上面的那個 row 可不可以固定住？」

## What Changes

- 外掛開放手機與平板安裝：`manifest.json` 的 `isDesktopOnly` 改成 `false`。
- 只有手機（由 Obsidian 判斷是不是手機，不看視窗寬度）換成「手機月視圖」。平板與電腦維持現在的年視圖、月視圖。
- 手機月視圖就是電腦上的月視圖，用同一套程式畫：
  - 一列一個專案、一欄一週，格子裡寫任務文字。完成的灰色加 `✓`，週已經過了還沒做的標紅，今天那週有標示，最右邊是 `還沒排`。
  - 專案名稱欄縮成 96 像素，固定在左邊。每週一欄至少 120 像素，`還沒排` 欄 48 像素。
  - 手機直放（約 390 像素寬）一次看到約 2 週，左右滑看其他週與 `還沒排`；手機橫放、寬度夠時一次看到整個月，每週欄寬平均分。
  - 上面一列只放 `顯示暫停（n）` 與月份導覽 `◀ 月份 ▶ 本月`。分頁打開時一律從今天這週所在的月份開始。
  - 打開分頁、換月份時，表格自動左右捲到本週，本週欄緊貼名稱欄右邊；本週的欄頭寫 `本週`。打勾、筆記改變這類重繪不捲動，留在使用者正在看的位置。
  - 往下滑時，表頭（`專案`、週數、`還沒排`）固定在表格最上面，控制列也一直留在畫面上方；表格自己上下、左右捲，分頁本身不捲。
  - 名稱欄藏掉檔名開頭的 `P-日期` 代碼（例如 `P-20260302 範例企業內訓規劃` 只顯示 `範例企業內訓規劃`），浮窗標題仍是完整名稱。
- 手機上的編輯跟電腦一樣：點格子打開週浮窗，可以打勾、`◀` `▶` 移一週、從還沒排挑任務、新增任務；點 `還沒排` 的數字，可以把任務排進某一週。寫回筆記、失敗提示與保護規則都沿用電腦版。浮窗在手機上不超出螢幕，按鈕的可點範圍至少 44×44 像素。
- 手機上點專案名稱（名稱欄或浮窗標題）或 `↗`，筆記開在儀表板自己的分頁，按 Obsidian 的返回回到儀表板。
- 拿掉第一版的 4 週清單與 `之前還沒做` 區塊，連同它們的程式、測試、樣式與截圖。
- 手機上不讀行事曆、不連網路，月視圖沒有 General 列。設定頁的 Calendars 區塊在手機上只顯示一句說明。
- README 兩種語言都加上手機版的說明與截圖，並刪掉「Desktop only」。

## Non-Goals

範圍外的項目與不採用的做法記在 design.md。

## Capabilities

### New Capabilities

- `dashboard-phone-month-view`: 手機上的儀表板。涵蓋手機版面的判斷、手機月視圖的欄寬與捲動（打開時捲到本週、表頭與控制列固定、名稱欄藏 `P-日期` 代碼）、在手機上用週浮窗與還沒排浮窗編輯、在手機上開啟筆記，以及手機上收起來的功能（年視圖、行事曆、說明面板、快捷鍵、改分類與狀態、設定頁的 Calendars 區塊）。

### Modified Capabilities

- `dashboard-obsidian-plugin`：`manifest.json` 改宣告 `isDesktopOnly: false`。README 的段落多一節手機版，並說明平板上的限制。
- `dashboard-calendar-row`：讀取行事曆的時機加上例外：在手機上，任何時機都不讀行事曆，也不註冊 `Refresh calendars` 指令。

## Impact

- Affected specs: dashboard-phone-month-view（新增）、dashboard-obsidian-plugin、dashboard-calendar-row
- Affected code:
  - New: tests/phone-month-view.test.ts, docs/images/phone-month-view.png, src/core/project-name.ts, tests/project-name.test.ts, tests/phone-this-week.test.ts
  - Modified: manifest.json, src/view.ts, src/month-view.ts, src/project-column.ts, src/core/popover-position.ts, scripts/screenshots/demo/obsidian-base.css, src/main.ts, src/settings-tab.ts, styles.css, tests/stubs/obsidian.ts, tests/popover-position.test.ts, scripts/screenshots/capture.py, scripts/screenshots/shim/obsidian.ts, scripts/screenshots/demo/main.ts, scripts/screenshots/README.md, README.md, README.zh-TW.md, docs/details.md, docs/details.zh-TW.md, CHANGELOG.md
  - Removed (moved to the macOS Trash): src/core/phone-weeks.ts, src/phone-week-list.ts, tests/phone-weeks.test.ts, tests/phone-week-list.test.ts, docs/images/phone-week-list.png
