## Why

外掛要開放別人用 BRAT 安裝，之後還要上架 Obsidian 社群商店。現在的 README 是一份很細的規則說明，英文和中文擠在同一個檔案，也沒有任何截圖。第一次打開的人看不出這個外掛長什麼樣、要怎麼開始用。朱騏希望 README 像他 Write 編輯器的教學一樣：白話、一步一步、配截圖，再附上他網站上講方法論的文章當延伸閱讀。

## What Changes

- README 拆成兩份：`README.md`（英文）和 `README.zh-TW.md`（繁體中文），兩份開頭互相連結，內容一致。
- 兩份都改成教學，依序是：
  - 這是什麼，附一張主畫面截圖。
  - 安裝：BRAT 與手動。
  - 第一次設定：專案資料夾、專案筆記要寫哪些欄位、任務日期。
  - 年視圖、週浮窗、月視圖與「還沒排」。
  - 行事曆 General 列。
  - 暫停的專案與切換狀態。
  - 設定頁、連網說明、第三方程式碼。
  - 延伸閱讀：朱騏網站 chichu.co 上的 6 篇文章，英文版註明文章是繁體中文。
- 原本 README 裡很細的規則說明搬到 `docs/details.md` 與 `docs/details.zh-TW.md`，README 在相關段落連過去。
- 新增可重複執行的截圖程式（`scripts/screenshots/`），用外掛真正的畫面程式搭配虛構的範例專案與範例行事曆，在瀏覽器裡畫出來再截圖，存到 `docs/images/`。截圖不使用任何真實筆記、名字或行事曆。
- `add-calendar-row` 規格裡「README 要用英文與繁體中文說明連網」的要求，改成兩份 README 都要有。

## Non-Goals

- 不改外掛的任何行為。
- 不錄示範影片。
- 不翻譯朱騏的部落格文章。
- 不寫成技術文件；開發說明維持精簡，放在 README 最後。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `dashboard-obsidian-plugin`: 新增 README 教學、雙語檔案與截圖的要求。

## Impact

- Affected specs: dashboard-obsidian-plugin
- Affected code:
  - New: README.zh-TW.md, docs/details.md, docs/details.zh-TW.md, docs/images/, scripts/screenshots/
  - Modified: README.md, AGENTS.md, .gitignore
