## Why

朱騏要開始排 2027 年，但年視圖固定顯示今天所在的年份，翻不到明年，只能用月視圖一個月一個月看。年視圖需要能切換年份。

## What Changes

- 年視圖的控制列，在月視圖放月份導覽的同一個位置，顯示 `◀`、`2026 年`、`▶`，可以切到前一年、後一年。
- 「回到現在」的按鈕只在需要時出現：年視圖翻到別的年份才出現 `今年`；月視圖的 `本月` 也改成同樣規則，翻到別的月份才出現。
- 切換年／月時沿用正在看的期間：
  - 年視圖在 2027 年時切到月視圖，顯示 2027 年 1 月；如果年視圖是今年，照舊顯示本月。
  - 月視圖切回年視圖，顯示那個月所在的年份。
  - 打開儀表板時，照舊從今年或本月開始。顯示的年份與月份都不記住。
- 年視圖可以看今年以外的年份後，修正一個跨年的顯示問題：專案的預計結束日期在前一年、但任務延伸到這一年時，這一年的超出期限週要照樣標紅，timeline 模式的色條也要從這一年第一週開始畫。
- 年視圖切換年份會關掉開著的浮窗；筆記變動造成的重繪保留顯示中的年份。
- 這個功能併進還沒發布的 0.5.0，README、CHANGELOG、名詞表同步更新。

## Non-Goals

- 年份不存進偏好，重開一律從今年開始。
- 不加切換年份的快捷鍵。
- 年視圖不顯示行事曆行程（維持行事曆列的規則）。
- 沒有結束日期的專案，預設結束日仍是今天所在年份的 12/31，不跟著顯示的年份變。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `dashboard-month-view`: 年／月切換的需求加上年份導覽、按需出現的 `今年`／`本月`，以及切換時沿用正在看的期間。
- `dashboard-obsidian-plugin`: 「年份跟著今天」改成年視圖從今年開始、可以切到別的年份；跨年專案的格子規則。
- `dashboard-note-sync`: 重繪時保留年視圖顯示的年份。

## Impact

- Affected specs: dashboard-month-view、dashboard-obsidian-plugin、dashboard-note-sync
- Affected code:
  - Modified: src/view.ts, src/core/cells.ts, src/core/months.ts, tests/cells.test.ts, tests/months.test.ts, styles.css, README.md, CHANGELOG.md, openspec/LANGUAGE.md
- 封存順序：`dashboard-note-sync` 的同一條需求也被進行中的 add-calendar-row 修改，這次的修改內容已經包含 add-calendar-row 的版本，所以必須先封存 add-calendar-row，再封存這個改動。
