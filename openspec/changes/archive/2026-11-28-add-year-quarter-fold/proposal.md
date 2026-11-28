## Why

年視圖一列一個專案、一欄一週，整年 53 週每週 32 像素，加上 280 像素的名稱欄，大約 1,980 像素寬。現在已經是 Q4，朱騏打開年視圖要一直往右捲，才看得到這幾週。他的原話：「在『年』的預覽上面，像現在已經 Q4 了，Q1、Q2、Q3 感覺應該要是可以折疊的，要不然其實我都要滾到最後。」

他也要一顆「本週」按鈕。討論時先提了「跳到月視圖」與「新增週視圖」兩種做法，他說明：「其實我的『本週』在電腦上，只是要能夠直接跳到整個年視圖裡面那個紅色的『本週』的意思」。所以「本週」是年視圖裡的捲動，不是換一種畫面。

## What Changes

- 年視圖的季標題變成可以點的按鈕：展開時寫 `Q4 ▾`，折起時寫 `Q1 ▸`。點一下折起或展開那一季。
- 折起的季只剩一條 40 像素寬的灰色窄欄，裡面不畫色條，也不能點開浮窗；色條碰到折起的季就停在邊上。
- 打開今年的年視圖時，今天這週所在季之前的季自動折起（現在是 Q1、Q2、Q3）。看其他年份時四季都展開。折疊狀態在同一個年份裡保留（筆記改了、勾顯示暫停、切到月視圖再回來都不變），換年份或重開分頁就回到預設，不存進偏好。
- 年視圖控制列原本的 `今年` 換成 `本週`（提示 `捲到本週`）。只有本週那一欄不在眼前時才出現：在看別的年份、本週所在的季被折起，或本週那一欄被捲到畫面外。按下去會回到今年、展開本週所在的季，並把本週那一欄捲到表格可見範圍的正中間。
- 月視圖的 `本月` 不變；手機沒有年視圖，不受影響。
- 說明面板：年視圖分頁加一行折起的季，操作分頁的切換寫成 `本週`、`本月` 回到現在，並加一行「點季標題折起或展開」。
- README、細節文件、更新紀錄與截圖一起更新。

## Non-Goals

範圍外的項目與不採用的做法記在 design.md。

## Capabilities

### New Capabilities

- `dashboard-year-quarter-fold`: 年視圖的季折疊（預設、切換、保留、畫法）與年視圖的 `本週` 按鈕（何時出現、按下去做什麼）。

### Modified Capabilities

- `dashboard-month-view`: 年視圖控制列的 `今年` 換成 `本週`。
- `dashboard-layout-spacing`: 53 週總寬 1,696 像素只在沒有折起任何季時成立。
- `dashboard-resizable-proj-col`: 同上，拖拉名稱欄寬時的總寬檢查只在沒有折起任何季時成立。
- `dashboard-keyboard-shortcuts`: 說明面板的年視圖與操作分頁加上折疊與 `本週`。

## Impact

- Affected specs: dashboard-year-quarter-fold（新增）、dashboard-month-view、dashboard-layout-spacing、dashboard-resizable-proj-col、dashboard-keyboard-shortcuts
- Affected code:
  - New: src/core/quarter-fold.ts, tests/quarter-fold.test.ts, tests/year-quarter-fold-view.test.ts
  - Modified: src/view.ts, styles.css, tests/help-panel.test.ts, scripts/screenshots/capture.py, scripts/screenshots/README.md, README.md, README.zh-TW.md, docs/details.md, docs/details.zh-TW.md, CHANGELOG.md, docs/images/year-view.png, docs/images/year-2027.png, docs/images/help-year.png, docs/images/week-popover.png, docs/images/paused-rows.png, docs/images/status-editing.png, manifest.json, package.json, package-lock.json
