## 1. 計算

- [x] 1.1 手機週清單的純計算（The phone week list shows this week and the next three weeks；Overdue tasks are kept in the 之前還沒做 section；設計：手機週清單沿用月視圖的週與任務計算）：新增 src/core/phone-weeks.ts，匯出 `phoneWeekLabels`、`phoneWeekGroups`、`overdueLines`、`scheduleToThisWeekDays`，只用既有的 `isoWeekOfDate`、`mondayOfWeek`、`taskLinesForWeek`、`weekOfTaskDate`、`scheduleDateForWeek`，不碰畫面與 Obsidian。驗證：tests/phone-weeks.test.ts 涵蓋規格的「Four weeks from today」（含 where each task appears 範例）、「The four weeks cross into the next year」、「The Saturday rule decides the week」、「Projects follow the dashboard's row order」、「Earlier days of this week are not overdue」、「Scheduling an overdue task into this week」與「Scheduling into this week with the Saturday exception」的天數計算。

## 2. 手機畫面與編輯

- [x] 2.1 版面判斷（Phone layout is chosen by Obsidian's phone check；設計：用 Obsidian 的手機判斷決定版面、手機上收起來的功能）：tests/stubs/obsidian.ts 提供可以改的 `Platform.isPhone`／`Platform.isTablet`；src/view.ts 在分頁打開時讀一次 `Platform.isPhone` 存成版面欄位，手機上不畫控制列（只留 `顯示暫停（n）`）、年／月切換、導覽、圖例、⚠、`?` 按鈕與說明面板、年視圖、月視圖；`M`、`T`、`?` 在手機上什麼都不做；沒有資料夾或沒有專案時顯示與電腦相同的提示。驗證：tests/phone-week-list.test.ts 涵蓋「A phone gets the week list」「A tablet keeps the year and month views」「A narrow desktop pane keeps the desktop layout」「Shortcuts do nothing on a phone」，既有 view 相關測試全部通過。
- [x] 2.2 4 週清單的畫面（The phone week list shows this week and the next three weeks；設計：手機版面的樣式與觸控大小）：新增 src/phone-week-list.ts 的 `PhoneWeekList` 與 host 介面（做法比照 `MonthView`），畫出週標題（`本週`／`下週`／空白＋`W<week>`＋`M/D–M/D`）、專案組（分類色點＋名稱）、任務行（核取方塊、文字、`M/D`）、`這週沒有任務`；`顯示暫停（n）` 沿用電腦的規則；styles.css 的手機樣式全部掛在 `.pd-phone` 底下，沿用既有顏色變數，可以點的範圍至少 44×44 CSS 像素，任務文字換行不切字。驗證：tests/phone-week-list.test.ts 涵蓋「Paused projects appear only when checked」「A done task stays in its week」、`這週沒有任務`、標題文字，並檢查電腦版截圖用到的類別沒有被手機樣式影響。
- [x] 2.3 每一行的編輯（Task lines are edited from the phone week list；設計：每一行的編輯按鈕沿用週浮窗的規則與寫入路徑、移出 4 週時用提示說明任務去哪了）：核取方塊與 `◀` `▶` 的出現與啟用條件和週浮窗相同，透過 view 既有的 toggle／shift 處理寫回筆記；寫入中停用那一行的按鈕；失敗時顯示與週浮窗相同的 `找不到這則筆記`／`這一行在筆記裡剛被改過，畫面已更新，請再試一次`／`寫入筆記失敗，請再試一次`，行被改過時重新掃描；移出 4 週時顯示 `已移到 <M/D>，在「之前還沒做」裡` 或 `已移到 <M/D>，超出這 4 週`。驗證：tests/phone-week-list.test.ts 涵蓋「Ticking a task on a phone」「Moving a task one week later」「Moving a task past the fourth week」「Moving a task before this week」「A recurring task cannot be ticked on a phone」「A changed line is not overwritten」，並比對寫回筆記的整行文字。
- [x] 2.4 之前還沒做區塊（Overdue tasks are kept in the 之前還沒做 section；設計：之前還沒做區塊收著過期的任務）：最上面的 `▸ 之前還沒做（n）` 標題列，分頁打開時收起，點一下展開成 `▾`；展開後照專案分組列出紅字任務、`M/D`、核取方塊與 `排到本週`（用 `shift` 與 `scheduleToThisWeekDays` 寫入，同一行只留一個 `📅`）；這一區打勾的行留到收起或重開分頁；n 只算沒完成的；收起且 n 為 0 時不出現；重繪時保留展開狀態與捲動位置。驗證：tests/phone-week-list.test.ts 涵蓋「Scheduling an overdue task into this week」「Scheduling into this week with the Saturday exception」「A ticked overdue task stays until the section closes」「No overdue tasks, no heading」，以及筆記改變後重繪仍保持展開。
- [x] 2.5 在手機上開啟筆記（A project note opens in the dashboard's tab on a phone；設計：在手機上開啟筆記改用同一個分頁）：手機上點專案名稱時，用儀表板自己的分頁打開筆記；電腦與平板照舊開在右側分割並重複使用。驗證：tests/phone-week-list.test.ts 檢查手機上呼叫的是儀表板自己分頁的 `openFile`、沒有建立分割；電腦版既有的開筆記測試仍通過。

## 3. 行事曆、設定與 manifest

- [x] 3.1 手機上不設定也不讀行事曆（Calendars are not set up or read on a phone；When calendars are fetched；設計：手機上收起來的功能）：src/main.ts 在手機上不開始任何讀取、不註冊 `Refresh calendars`；src/settings-tab.ts 在手機上的 Calendars 區塊只顯示標題與 `Calendar events show on a computer or tablet. Add your calendars there.`，不呼叫 `app.secretStorage`；手機上存其他設定時 `calendars` 原樣保留。驗證：測試涵蓋「A phone never fetches」（沒有任何 `requestUrl` 呼叫、指令沒註冊）、「Settings on a phone」「Other settings keep the calendars」，既有行事曆測試全部通過。
- [x] 3.2 manifest 開放手機與平板（Build and deploy into the vault）：manifest.json 的 `isDesktopOnly` 改成 `false`，其他欄位不變。驗證：`npm run build` 之後檢查 manifest.json 含 `"isDesktopOnly": false`（情境「The manifest allows phones and tablets」）。

## 4. 文件與截圖

- [x] 4.1 手機截圖（README teaches setup and everyday use；設計：README 與截圖加上手機版）：scripts/screenshots/shim/obsidian.ts 提供可以改的 `Platform.isPhone`，scripts/screenshots/capture.py 加一張 docs/images/phone-week-list.png：畫布寬 390 像素、範例資料、展開 `之前還沒做`。驗證：`npm run screenshots:build` 再跑 `python3 scripts/screenshots/capture.py`，逐張目視檢查新圖沒有切字、沒有真實資料；原本 10 張圖重新產生後內容不變。
- [x] 4.2 README、details 與更新紀錄（README teaches setup and everyday use；設計：README 與截圖加上手機版）：README.md 與 README.zh-TW.md 在暫停的專案那一節之後、設定之前加手機版一節並放 phone-week-list.png；安裝段落改成電腦、平板、手機都能用，並寫平板上拖拉排序與拖拉欄寬需要滑鼠或觸控板；網路使用段落補一句手機上不連網路；docs/details.md 與 docs/details.zh-TW.md 補哪 4 週、過期的定義、排到本週寫哪一天、移出 4 週的提示；CHANGELOG.md 加 0.6.0 英文與中文說明。驗證：重讀差異，確認情境「Both READMEs explain the phone week list」與「Both READMEs have the same sections and images」成立，兩份 README 不再出現 Desktop only。

## 5. 驗收

- [x] 5.1 自動驗收與部署：`npm test`、`npm run lint`、`npm run build` 全部通過，部署到本機 vault；在電腦上打開儀表板確認年視圖、月視圖、說明面板與行事曆和 0.5.0 相同。驗證：貼出指令結果，並以 4.1 重新產生的 10 張電腦版截圖佐證畫面沒變。
- [ ] 5.2 朱騏在手機上實測：打開清單、打勾與取消、`▶` 移一週、`排到本週`、點專案名稱再按返回回到儀表板、設定頁的 Calendars 只顯示一句說明。驗證：朱騏在對話中確認；按返回回不到儀表板時，依設計的風險處理改成開新分頁並更新規格與 README。
