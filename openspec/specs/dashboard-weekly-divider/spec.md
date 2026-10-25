# dashboard-weekly-divider Specification

## Purpose

Draw subtle week, month, and quarter divider lines across the chart without interrupting the visual continuity of a project's gantt bar.

## Requirements

### Requirement: 每週欄位顯示縱向分隔線

每個代表單一 ISO 週的儲存格（`td.week-cell`）SHALL 在其左邊緣顯示一條 1 像素寬、顏色為極淡灰（hex `#f1f5f9`）的縱向分隔線，標示該週與前一週的邊界。

#### Scenario: 一般週欄位顯示極淡分隔線

- **WHEN** 儀錶板載入完成
- **AND** 一般週欄位（非月份起始、非季度起始）位於畫面中
- **THEN** 該儲存格的左邊緣 MUST 顯示寬度為 1px、顏色為 `#f1f5f9` 的縱向線
- **AND** 該線 MUST 透過 `box-shadow: inset` 實作而非 `border-left`，以維持與月份/季度分隔線一致的繪製層級

##### Example: 第 W3 與 W4 之間的分隔線
- **GIVEN** 表格中存在 W3 與 W4 兩個普通週欄位
- **WHEN** 使用者在沒有色條覆蓋的列肉眼觀察兩格之間
- **THEN** MUST 看到一條極淡灰色細線位於 W4 的左邊緣
- **AND** 該線顏色 RGB 值 MUST 等於 `rgb(241, 245, 249)`

---
### Requirement: 分隔線視覺強度階層

週分隔線 SHALL 在視覺強度上明顯低於月份分隔線，月份分隔線 SHALL 在視覺強度上明顯低於季度分隔線，形成「**季 > 月 > 週**」的三層階層。

#### Scenario: 三層分隔線並排比較

- **WHEN** 使用者同時觀察一條季度起始線、一條月份起始線、一條普通週分隔線
- **THEN** 季度線 MUST 為 2px、顏色 `#94a3b8`
- **AND** 月份線 MUST 為 1px、顏色 `#94a3b8`
- **AND** 週分隔線 MUST 為 1px、顏色 `#f1f5f9`（明顯比月份線淡）
- **AND** 三條線的視覺顯著度排序 MUST 為：季度 > 月份 > 週

---
### Requirement: 分隔線不切過色條

週分隔線 MUST NOT 被繪製在色條（`.bar`）之上。任何被色條覆蓋的週分隔線位置，使用者 MUST NOT 看到該線。

#### Scenario: 色條覆蓋處不可見

- **WHEN** 一條色條跨越多週並覆蓋若干週分隔線位置
- **THEN** 被色條覆蓋的週分隔線 MUST NOT 在色條表面可見
- **AND** 色條未覆蓋的週分隔線位置 MUST 仍正常可見

##### Example: 範例專案 色條跨 52 週
- **GIVEN** 專案 範例專案（W1 ~ W52）的紫色色條覆蓋整列
- **WHEN** 使用者觀察該列的色條表面
- **THEN** 色條表面 MUST NOT 出現任何縱向細線
- **AND** 同欄但在其他空白列（無色條覆蓋）的同一週位置 MUST 仍可見極淡週分隔線

---
### Requirement: 移除既有季度交錯背景

`.q-even` 季度交錯背景樣式（每隔一季給儲存格加 `#fafbfc` 淺底色）SHALL 被移除，避免與週分隔線的視覺密度疊加造成階層模糊。

#### Scenario: 第二、第四季度不再顯示交錯背景

- **WHEN** 儀錶板載入完成
- **THEN** 隸屬 Q2 或 Q4 的週欄位背景色 MUST 與隸屬 Q1 或 Q3 的週欄位背景色一致
- **AND** 階層分組 MUST 仍可透過 表頭 Q1–Q4 標籤、月份名稱、月/季縱向分隔線辨識

---
### Requirement: 維持既有色條與互動行為

加入週分隔線時 MUST NOT 變更以下既有行為：色條的 `z-index: 3`、色條起訖計算、配色映射、虛線（未確定專案）、淡化（已完成/取消專案）、Pin 類別排序、亮色版主題、「今天」紅色高亮欄位、篩選勾選框。

#### Scenario: 互動回歸驗證

- **WHEN** 加入週分隔線後重新載入儀錶板
- **THEN** 點擊「企業內訓」圖例 MUST 仍將該類專案排到最上方
- **AND** 切換「顯示已完成」勾選框 MUST 仍正確顯示/隱藏已完成專案
- **AND** 今日週欄位 MUST 仍顯示紅色淡底高亮
- **AND** 跨多週進行中專案色條（W18→W50）MUST 仍為單一連續色塊、無縱向細線切過
