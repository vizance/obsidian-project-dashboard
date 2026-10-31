## MODIFIED Requirements

### Requirement: 依類別排序按鈕

The previous toggle button labeled「依類別排序」(id `sort-by-category`) SHALL be removed from the UI. No alternative sort toggle SHALL replace it. The `.controls` block SHALL contain the「顯示已結案」checkbox, the「編輯分類」checkbox, the `年` / `月` switch, and, while the month view is shown, the month navigation (`◀`, the month title, `▶`, `本月`); it SHALL NOT contain any sort control.

#### Scenario: 按鈕不再出現

- **WHEN** 使用者載入儀錶板
- **THEN** `document.getElementById('sort-by-category')` MUST 回傳 `null`
- **AND** `.controls` 區塊內 MUST NOT 有任何排序用的控制項
