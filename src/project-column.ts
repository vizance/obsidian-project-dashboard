import { CATEGORIES } from './core/config';
import type { ProjectRecord, ProjectStatus } from './core/scan';

// 專案欄由年視圖與月視圖共用。拖拉欄寬、編輯分類、點專案名稱開筆記都是掛在
// `#chart` 上的委派事件（view.ts 的 registerInteractions），所以兩個視圖只要畫出
// 同樣的元素與類別，那些處理器就不必分視圖，也不會有兩份會走偏的複製品。

export function renderProjectColHeader(row: HTMLTableRowElement, rowspan: number): HTMLTableCellElement {
	const th = row.createEl('th', { cls: 'proj-col', attr: { rowspan }, text: '專案' });
	th.createSpan({ cls: 'resize-handle', attr: { title: '拖拉調整欄寬' } });
	return th;
}

// 已結案專案的色條（年視圖）與格子（月視圖）都要套這個類別才會灰掉。
export function projectStateClass(project: ProjectRecord): string {
	return project.status === 'done' ? 'done' : project.status === 'cancelled' ? 'cancelled' : '';
}

export function renderProjectHeadCell(
	tr: HTMLTableRowElement,
	project: ProjectRecord,
	categoryOrder: string[],
): HTMLTableCellElement {
	if (project.status === 'pending') tr.addClass('status-pending');
	const statusCls = project.status === 'done'
		? 'status-done'
		: project.status === 'cancelled' ? 'status-cancelled' : '';

	const projCell = tr.createEl('td', { cls: ['proj-cell', statusCls].filter(Boolean).join(' ') });
	projCell.setCssProps({ '--pd-cat-color': project.color });
	projCell.createSpan({ cls: 'cat-dot' });
	projCell.createSpan({
		cls: 'name',
		text: project.name,
		attr: { title: '在右側開啟筆記', 'data-path': project.path },
	});
	if (project.warnings.length > 0) {
		projCell.createSpan({ cls: 'warn', text: '⚠', attr: { title: project.warnings.join(', ') } });
	}

	const editors = projCell.createDiv({ cls: 'project-editors' });
	const select = editors.createEl('select', {
		cls: 'cat-select',
		attr: { 'data-project': project.name, title: '變更此專案的分類（自動＝清除手動覆寫）' },
	});
	select.createEl('option', { attr: { value: '__auto__' }, text: '自動（清除覆寫）' });
	for (const key of categoryOrder) {
		const category = CATEGORIES[key];
		if (!category) continue;
		const option = select.createEl('option', { attr: { value: key }, text: category.label });
		if (key === project.category) option.selected = true;
	}

	const statusSelect = editors.createEl('select', {
		cls: 'status-select',
		attr: { 'data-path': project.path, 'aria-label': '變更專案狀態', title: '變更專案狀態' },
	});
	const statuses: Array<[ProjectStatus, string]> = [
		['active', '🚧 進行中'],
		['pending', '⏳ 暫停'],
		['done', '✅ 完成'],
		['cancelled', '❌ 取消'],
	];
	for (const [status, label] of statuses) {
		statusSelect.createEl('option', { attr: { value: status }, text: label });
	}
	statusSelect.value = project.status;

	return projCell;
}
