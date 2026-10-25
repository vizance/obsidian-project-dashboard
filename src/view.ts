import { ItemView, Scope, TFile, type WorkspaceLeaf } from 'obsidian';
import { CATEGORIES, CATEGORY_KEYS } from './core/config';
import type { Cell } from './core/cells';
import { perWeekCells, sortProjects, timelineCells, visibleProjects } from './core/cells';
import {
	applyCategoryOverride,
	clampProjColWidth,
	parseCategoryOrder,
	parsePinnedCategory,
	parseProjColWidth,
	parseViewMode,
	resolveInitialHelpPanel,
} from './core/prefs';
import type { ProjectRecord } from './core/scan';
import { buildWeeks, groupMonths, groupQuarters, todayLocal, todayWeekIndex, type WeekInfo } from './core/weeks';
import type ProjectDashboardPlugin from './main';
import type { VaultSource } from './vault-source';

export const VIEW_TYPE_DASHBOARD = 'project-dashboard-view';

const MONTH_NAMES = [
	'1月', '2月', '3月', '4月', '5月', '6月',
	'7月', '8月', '9月', '10月', '11月', '12月',
];

const LEGEND_DRAG_THRESHOLD = 5;

export class ProjectDashboardView extends ItemView {
	private today = '';
	private viewMode: 'per-week' | 'timeline' = 'per-week';
	private categoryOrder: string[] = [];
	private pinnedCategory: string | null = null;
	private projColWidth = 280;
	private showClosed = false;
	private helpPanelOpen = false;
	private popoverAnchor: HTMLElement | null = null;
	private toastTimer: number | null = null;
	private noteLeaf: WorkspaceLeaf | null = null;
	private unsubscribeVaultSource: (() => void) | null = null;

	private projects: ProjectRecord[] = [];
	private missingFolderMessage: string | null = null;

	private metaEl!: HTMLElement;
	private legendEl!: HTMLElement;
	private chartEl!: HTMLElement;
	private helpPanelEl!: HTMLElement;
	private helpFabEl!: HTMLElement;
	private popoverEl!: HTMLElement;
	private toastEl!: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly vaultSource: VaultSource,
		private readonly plugin: ProjectDashboardPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return '專案總覽';
	}

	getIcon(): string {
		return 'calendar-range';
	}

	async onOpen(): Promise<void> {
		this.today = todayLocal();
		this.loadPreferences();
		this.scope = new Scope(this.app.scope);
		this.registerShortcuts();
		this.buildLayout();
		this.registerInteractions();
		await this.rescanAndRender();
		this.unsubscribeVaultSource = this.vaultSource.onChange(() => {
			void this.handleVaultChange();
		});
	}

	async onClose(): Promise<void> {
		this.unsubscribeVaultSource?.();
		this.unsubscribeVaultSource = null;
		this.contentEl.empty();
	}

	// Triggered by vault-source's debounced re-scan notification (design.md:
	// "重繪時保留畫面狀態") — rebuild only stats/legend/chart, restore scroll,
	// and drop any open popover since the cell it pointed at is gone.
	private async handleVaultChange(): Promise<void> {
		const scrollLeft = this.chartEl.scrollLeft;
		const scrollTop = this.contentEl.scrollTop;
		this.closeWeekPopover();
		this.today = todayLocal();
		await this.rescanAndRender();
		this.chartEl.scrollLeft = scrollLeft;
		this.contentEl.scrollTop = scrollTop;
	}

	// Later tasks call this after a background re-scan; rebuilds the stats,
	// legend, and chart only (design.md: "重繪時保留畫面狀態" keeps the controls row).
	render(): void {
		this.renderMeta();
		this.renderLegend();
		this.renderChart();
	}

	private readLocalStorage(key: string): string | null {
		try {
			return this.app.loadLocalStorage(key) as string | null;
		} catch {
			return null;
		}
	}

	private writeLocalStorage(key: string, value: string): void {
		try {
			this.app.saveLocalStorage(key, value);
		} catch {
			/* 讀寫失敗退回預設值，不中斷畫面 */
		}
	}

	private loadPreferences(): void {
		this.viewMode = parseViewMode(this.readLocalStorage('dashboard.viewMode'));
		this.categoryOrder = parseCategoryOrder(this.readLocalStorage('dashboard.categoryOrder'), CATEGORY_KEYS);
		this.pinnedCategory = parsePinnedCategory(this.readLocalStorage('dashboard.pinnedCategory'), CATEGORY_KEYS);
		this.projColWidth = parseProjColWidth(this.readLocalStorage('dashboard.projColWidth'));

		const resolved = resolveInitialHelpPanel(
			this.readLocalStorage('dashboard.helpFirstSeen'),
			this.readLocalStorage('dashboard.helpPanelOpen'),
		);
		this.helpPanelOpen = resolved.visible;
		if (resolved.markFirstSeen) {
			this.writeLocalStorage('dashboard.helpFirstSeen', 'true');
			this.writeLocalStorage('dashboard.helpPanelOpen', 'true');
		}
	}

	private buildLayout(): void {
		this.contentEl.empty();
		this.contentEl.addClass('project-dashboard');
		this.contentEl.setCssProps({ '--proj-col-width': `${this.projColWidth}px` });

		const header = this.contentEl.createEl('header');
		header.createEl('h1', { text: '專案總覽' });
		this.metaEl = header.createSpan({ cls: 'meta' });
		this.legendEl = header.createDiv({ cls: 'legend' });

		const controls = this.contentEl.createDiv({ cls: 'controls' });
		const showClosedLabel = controls.createEl('label');
		const showClosedInput = showClosedLabel.createEl('input', { attr: { type: 'checkbox', id: 'show-closed' } });
		showClosedLabel.appendText('顯示已結案（已完成 + 取消）');
		const editCategoriesLabel = controls.createEl('label');
		const editCategoriesInput = editCategoriesLabel.createEl('input', { attr: { type: 'checkbox', id: 'edit-categories' } });
		editCategoriesLabel.appendText('編輯分類');

		this.registerDomEvent(showClosedInput, 'change', () => {
			this.showClosed = showClosedInput.checked;
			this.renderChart();
		});
		this.registerDomEvent(editCategoriesInput, 'change', () => {
			this.contentEl.toggleClass('editing-categories', editCategoriesInput.checked);
		});

		this.chartEl = this.contentEl.createDiv({ attr: { id: 'chart' } });

		this.buildHelpPanel();
		this.helpFabEl = this.contentEl.createEl('button', {
			cls: '',
			attr: {
				id: 'help-fab',
				type: 'button',
				title: '顯示快捷鍵與圖示說明（? 也可切換）',
				'aria-label': '開啟說明面板',
			},
			text: '?',
		});
		this.registerDomEvent(this.helpFabEl, 'click', () => this.toggleHelpPanel(true));

		this.popoverEl = this.contentEl.createDiv({
			attr: { id: 'week-popover', role: 'dialog', 'aria-label': '本週任務' },
		});
		this.popoverEl.hidden = true;

		this.toastEl = this.contentEl.createDiv({ attr: { id: 'toast', role: 'status', 'aria-live': 'polite' } });
		this.toastEl.hidden = true;

		this.setHelpPanelVisible(this.helpPanelOpen);
	}

	private buildHelpPanel(): void {
		this.helpPanelEl = this.contentEl.createDiv({
			attr: { id: 'help-panel', 'aria-label': '快捷鍵與圖示說明' },
		});
		const closeBtn = this.helpPanelEl.createEl('button', {
			cls: 'close-btn',
			attr: { id: 'help-close', title: '關閉（也可按 ? 切換）' },
			text: '×',
		});
		this.registerDomEvent(closeBtn, 'click', () => this.toggleHelpPanel(false));

		const shortcuts = this.helpPanelEl.createEl('section', { cls: 'shortcuts' });
		shortcuts.createEl('h3', { text: '快捷鍵' });
		const shortcutsUl = shortcuts.createEl('ul');
		const tLi = shortcutsUl.createEl('li');
		tLi.createEl('kbd', { text: 'T' });
		tLi.appendText(' 切換週視圖 / Timeline');
		const helpLi = shortcutsUl.createEl('li');
		helpLi.createEl('kbd', { text: '?' });
		helpLi.appendText(' 顯示 / 隱藏這個面板');

		const legendVisual = this.helpPanelEl.createEl('section', { cls: 'legend-visual' });
		legendVisual.createEl('h3', { text: '圖示說明' });
		const legendUl = legendVisual.createEl('ul');

		const addLegendRow = (swatchCls: string, build: (container: HTMLElement) => void): void => {
			const li = legendUl.createEl('li');
			li.createSpan({ cls: `swatch ${swatchCls}` });
			const div = li.createDiv();
			build(div);
		};

		addLegendRow('solid', (div) => div.appendText('該週有任務排定（尚未完成）'));
		addLegendRow('settled', (div) => div.appendText('該週任務已全部完成'));
		addLegendRow('dashed', (div) => div.appendText('該週無任務（仍在專案區間）'));
		addLegendRow('overflow', (div) => {
			div.appendText('超出原訂結束日（scope creep）— 該回去更新 frontmatter ');
			div.createEl('code', { text: '預計結束日期' });
		});
		addLegendRow('blank', (div) => div.appendText('不在專案區間 / 已結案專案的無任務週'));
	}

	private registerInteractions(): void {
		this.registerLegendDrag();
		this.registerResizeHandle();
		this.registerCategoryOverride();
		this.registerWeekPopover();
		this.registerProjectNameClick();
	}

	private registerShortcuts(): void {
		const scope = this.scope;
		if (!scope) return;

		// Obsidian's KeymapEventListener contract: return `false` to preventDefault
		// (shortcut handled); return `true` (or anything else) to let the default/
		// other handling proceed (shortcut ignored). Getting this backwards makes
		// every handled key immediately leak into Obsidian's own keymap too.
		const toggleViewMode = (evt: KeyboardEvent): boolean => {
			if (this.shouldIgnoreShortcut(evt)) return true;
			this.viewMode = this.viewMode === 'timeline' ? 'per-week' : 'timeline';
			this.writeLocalStorage('dashboard.viewMode', this.viewMode);
			this.renderChart();
			return false;
		};
		const toggleHelp = (evt: KeyboardEvent): boolean => {
			if (this.shouldIgnoreShortcut(evt)) return true;
			this.toggleHelpPanel();
			return false;
		};
		const closeOnEscape = (evt: KeyboardEvent): boolean => {
			if (this.shouldIgnoreShortcut(evt)) return true;
			if (!this.popoverAnchor) return true;
			this.closeWeekPopover();
			return false;
		};

		// Explicit modifier arrays (never `null`) so Cmd/Ctrl/Alt combinations such
		// as Cmd+T (Obsidian's new-tab shortcut) never match this scope at all.
		scope.register([], 't', toggleViewMode);
		scope.register([], 'T', toggleViewMode); // caps lock: capital T without the Shift flag
		scope.register(['Shift'], 'T', toggleViewMode);
		scope.register([], '/', toggleHelp);
		scope.register(['Shift'], '?', toggleHelp);
		scope.register([], 'Escape', closeOnEscape);
	}

	private shouldIgnoreShortcut(evt: KeyboardEvent): boolean {
		const tag = (evt.target as HTMLElement | null)?.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
	}

	private toggleHelpPanel(forceOpen?: boolean): void {
		const next = typeof forceOpen === 'boolean' ? forceOpen : !this.helpPanelOpen;
		this.helpPanelOpen = next;
		this.setHelpPanelVisible(next);
		this.writeLocalStorage('dashboard.helpPanelOpen', next ? 'true' : 'false');
	}

	private setHelpPanelVisible(visible: boolean): void {
		this.helpPanelEl.hidden = !visible;
		this.helpFabEl.hidden = visible;
	}

	private registerLegendDrag(): void {
		this.registerDomEvent(this.legendEl, 'mousedown', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const item = target.closest<HTMLElement>('.legend-item');
			if (!item) return;
			if (target.classList.contains('resize-handle')) return;
			const draggedKey = item.dataset.category;
			if (!draggedKey) return;

			const startX = e.clientX;
			const startY = e.clientY;
			let dragging = false;
			let dropTargetEl: HTMLElement | null = null;

			const onMove = (ev: MouseEvent): void => {
				const dx = Math.abs(ev.clientX - startX);
				const dy = Math.abs(ev.clientY - startY);
				if (!dragging && Math.max(dx, dy) > LEGEND_DRAG_THRESHOLD) {
					dragging = true;
					item.classList.add('dragging');
				}
				if (!dragging) return;
				const hovered = (activeDocument.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)
					?.closest('.legend-item') as HTMLElement | null;
				if (dropTargetEl && dropTargetEl !== hovered) {
					dropTargetEl.classList.remove('drop-target');
					dropTargetEl = null;
				}
				if (hovered && hovered !== item && !hovered.classList.contains('drop-target')) {
					hovered.classList.add('drop-target');
					dropTargetEl = hovered;
				}
			};

			const onUp = (ev: MouseEvent): void => {
				activeDocument.removeEventListener('mousemove', onMove);
				activeDocument.removeEventListener('mouseup', onUp);
				item.classList.remove('dragging');
				if (dropTargetEl) dropTargetEl.classList.remove('drop-target');

				if (!dragging) {
					this.pinnedCategory = this.pinnedCategory === draggedKey ? null : draggedKey;
					this.writeLocalStorage('dashboard.pinnedCategory', JSON.stringify(this.pinnedCategory));
					this.render();
					return;
				}

				const dropEl = (activeDocument.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)
					?.closest('.legend-item') as HTMLElement | null;
				if (!dropEl || dropEl === item) return;
				const targetKey = dropEl.dataset.category;
				if (!targetKey) return;
				const order = this.categoryOrder.slice();
				const from = order.indexOf(draggedKey);
				const to = order.indexOf(targetKey);
				if (from === -1 || to === -1) return;
				order.splice(from, 1);
				const insertAt = order.indexOf(targetKey);
				order.splice(insertAt, 0, draggedKey);
				this.categoryOrder = order;
				this.writeLocalStorage('dashboard.categoryOrder', JSON.stringify(order));
				this.render();
			};

			this.registerDomEvent(activeDocument, 'mousemove', onMove);
			this.registerDomEvent(activeDocument, 'mouseup', onUp);
		});
	}

	private registerResizeHandle(): void {
		this.registerDomEvent(this.chartEl, 'mousedown', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.classList.contains('resize-handle')) return;
			e.preventDefault();
			target.classList.add('dragging');
			this.contentEl.addClass('col-resizing');
			const startX = e.clientX;
			const startWidth = this.projColWidth;

			const onMove = (ev: MouseEvent): void => {
				this.projColWidth = clampProjColWidth(startWidth + (ev.clientX - startX));
				this.contentEl.setCssProps({ '--proj-col-width': `${this.projColWidth}px` });
			};
			const onUp = (): void => {
				activeDocument.removeEventListener('mousemove', onMove);
				activeDocument.removeEventListener('mouseup', onUp);
				this.contentEl.removeClass('col-resizing');
				target.classList.remove('dragging');
				this.writeLocalStorage('dashboard.projColWidth', String(Math.round(this.projColWidth)));
			};

			this.registerDomEvent(activeDocument, 'mousemove', onMove);
			this.registerDomEvent(activeDocument, 'mouseup', onUp);
		});
	}

	private registerCategoryOverride(): void {
		this.registerDomEvent(this.chartEl, 'change', (e: Event) => {
			const select = e.target as HTMLSelectElement;
			if (!select.classList?.contains('cat-select')) return;
			void this.handleCategoryOverrideChange(select);
		});
	}

	private async handleCategoryOverrideChange(select: HTMLSelectElement): Promise<void> {
		const project = select.dataset.project;
		if (!project) return;
		const category = select.value === '__auto__' ? null : select.value;
		const result = applyCategoryOverride(this.plugin.data.categoryOverrides, project, category, CATEGORY_KEYS);
		if (!result.ok) return;

		try {
			await this.plugin.saveData({ categoryOverrides: result.overrides });
			this.plugin.data.categoryOverrides = result.overrides;
			this.showToast('已更新分類');
			await this.rescanAndRender();
		} catch (err) {
			console.error('[project-dashboard] 儲存分類覆寫失敗', err);
			this.showToast('分類儲存失敗，請再試一次', true);
			this.renderChart();
		}
	}

	// design.md: "在右側分割開啟筆記並重複使用" — clicking a project name opens its
	// note in a split to the right, reusing that split while it is still attached.
	private registerProjectNameClick(): void {
		this.registerDomEvent(this.chartEl, 'click', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest('.cat-select')) return;
			const nameEl = target.closest<HTMLElement>('.name');
			if (!nameEl) return;
			const path = nameEl.dataset.path;
			if (!path) return;
			void this.openProjectNote(path);
		});
	}

	private async openProjectNote(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return;
		const leaf = this.getOrCreateNoteLeaf();
		await leaf.openFile(file);
	}

	private getOrCreateNoteLeaf(): WorkspaceLeaf {
		if (this.noteLeaf && this.isLeafAttached(this.noteLeaf)) {
			return this.noteLeaf;
		}
		const leaf = this.app.workspace.createLeafBySplit(this.leaf, 'vertical');
		this.noteLeaf = leaf;
		return leaf;
	}

	private isLeafAttached(leaf: WorkspaceLeaf): boolean {
		let attached = false;
		this.app.workspace.iterateAllLeaves((l) => {
			if (l === leaf) attached = true;
		});
		return attached;
	}

	private showToast(message: string, isError = false): void {
		this.toastEl.setText(message);
		this.toastEl.toggleClass('toast-error', isError);
		this.toastEl.hidden = false;
		if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
		this.toastTimer = window.setTimeout(() => {
			this.toastEl.hidden = true;
		}, isError ? 6000 : 2500);
	}

	private registerWeekPopover(): void {
		this.registerDomEvent(activeDocument, 'click', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!this.popoverEl.hidden && this.popoverEl.contains(target)) return;
			const cell = target.closest ? target.closest<HTMLElement>('.bar-solid, .bar-overflow') : null;
			const title = cell?.getAttribute('title')?.trim();
			if (cell && title) {
				if (this.popoverAnchor === cell && !this.popoverEl.hidden) {
					this.closeWeekPopover();
				} else {
					this.openWeekPopover(cell);
				}
				return;
			}
			this.closeWeekPopover();
		});
		this.registerDomEvent(activeWindow, 'scroll', () => this.closeWeekPopover(), true);
	}

	private openWeekPopover(cell: HTMLElement): void {
		this.popoverEl.setText(cell.getAttribute('title') ?? '');
		this.popoverAnchor = cell;
		this.positionWeekPopover(cell);
	}

	private closeWeekPopover(): void {
		this.popoverEl.hidden = true;
		this.popoverAnchor = null;
	}

	private positionWeekPopover(cell: HTMLElement): void {
		this.popoverEl.hidden = false; // 先顯示才能量到尺寸
		const rect = cell.getBoundingClientRect();
		const pw = this.popoverEl.offsetWidth;
		const ph = this.popoverEl.offsetHeight;
		const gap = 6;
		let left = rect.left;
		let top = rect.bottom + gap;
		if (left + pw > activeWindow.innerWidth - 4) left = Math.max(4, rect.right - pw);
		if (top + ph > activeWindow.innerHeight - 4) top = Math.max(4, rect.top - gap - ph);
		this.popoverEl.setCssProps({ '--pd-popover-left': `${left}px`, '--pd-popover-top': `${top}px` });
	}

	private async rescanAndRender(): Promise<void> {
		const result = await this.vaultSource.scan(this.today);
		if (result.status === 'missing-folder') {
			this.missingFolderMessage = `找不到專案資料夾：${result.folder}`;
			this.projects = [];
		} else {
			this.missingFolderMessage = null;
			this.projects = result.projects;
		}
		this.render();
	}

	private renderMeta(): void {
		this.metaEl.setText(`更新於 ${this.today}  ·  共 ${this.projects.length} 個專案`);
	}

	private renderLegend(): void {
		this.legendEl.empty();
		for (const key of this.categoryOrder) {
			const category = CATEGORIES[key];
			if (!category) continue;
			const item = this.legendEl.createDiv({
				cls: ['legend-item', this.pinnedCategory === key ? 'active' : ''].filter(Boolean).join(' '),
				attr: { title: '點擊：pin 此類到最上（再點取消）；拖拉：調整類別順序' },
			});
			item.dataset.category = key;
			const swatch = item.createSpan({ cls: 'legend-swatch' });
			swatch.setCssProps({ '--pd-cat-color': category.color });
			item.appendText(category.label);
		}
	}

	private renderChart(): void {
		this.chartEl.empty();
		if (this.missingFolderMessage) {
			this.chartEl.createDiv({ cls: 'empty', text: this.missingFolderMessage });
			return;
		}

		const year = Number(this.today.slice(0, 4));
		const weeks = buildWeeks(year);
		const quarterGroups = groupQuarters(weeks);
		const monthGroups = groupMonths(weeks);
		const todayIdx = todayWeekIndex(weeks, this.today);
		const visible = sortProjects(
			visibleProjects(this.projects, this.showClosed),
			this.categoryOrder,
			this.pinnedCategory,
		);

		const table = this.chartEl.createEl('table', { cls: 'gantt' });
		const thead = table.createEl('thead');

		const quarterRow = thead.createEl('tr');
		const projTh = quarterRow.createEl('th', { cls: 'proj-col', attr: { rowspan: 3 }, text: '專案' });
		projTh.createSpan({ cls: 'resize-handle', attr: { title: '拖拉調整欄寬' } });
		for (const qg of quarterGroups) {
			quarterRow.createEl('th', { cls: 'quarter', attr: { colspan: qg.count }, text: `Q${qg.q}` });
		}

		const monthRow = thead.createEl('tr');
		for (const mg of monthGroups) {
			monthRow.createEl('th', { cls: 'month-label', attr: { colspan: mg.count }, text: MONTH_NAMES[mg.month] ?? '' });
		}

		const weekRow = thead.createEl('tr');
		for (const w of weeks) {
			const cls = ['week'];
			if (w.isQuarterStart) cls.push('q-start');
			else if (w.isMonthStart) cls.push('m-start');
			weekRow.createEl('th', { cls: cls.join(' '), text: `W${w.week}` });
		}

		const tbody = table.createEl('tbody');
		if (visible.length === 0) {
			const tr = tbody.createEl('tr');
			tr.createEl('td', { cls: 'proj-cell', text: '（沒有符合條件的專案）' });
			tr.createEl('td', { attr: { colspan: weeks.length } });
			return;
		}

		for (const project of visible) {
			this.renderProjectRow(tbody, project, weeks, todayIdx);
		}
	}

	private renderProjectRow(
		tbody: HTMLTableSectionElement,
		project: ProjectRecord,
		weeks: WeekInfo[],
		todayIdx: number,
	): void {
		const stateCls = project.status === 'done' ? 'done' : project.status === 'cancelled' ? 'cancelled' : '';
		const statusCls = project.status === 'done' ? 'status-done' : project.status === 'cancelled' ? 'status-cancelled' : '';

		const tr = tbody.createEl('tr');
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

		const select = projCell.createEl('select', {
			cls: 'cat-select',
			attr: { 'data-project': project.name, title: '變更此專案的分類（自動＝清除手動覆寫）' },
		});
		select.createEl('option', { attr: { value: '__auto__' }, text: '自動（清除覆寫）' });
		for (const key of this.categoryOrder) {
			const category = CATEGORIES[key];
			if (!category) continue;
			const option = select.createEl('option', { attr: { value: key }, text: category.label });
			if (key === project.category) option.selected = true;
		}

		const cells: Cell[] = this.viewMode === 'timeline' ? timelineCells(project, weeks) : perWeekCells(project, weeks);
		weeks.forEach((w, i) => {
			const cell = cells[i]!;
			const borderCls = w.isQuarterStart ? 'q-start' : w.isMonthStart ? 'm-start' : '';
			const cellCls = ['week-cell', i === todayIdx ? 'today-col' : '', borderCls].filter(Boolean).join(' ');
			const td = tr.createEl('td', { cls: cellCls });
			this.renderBar(td, cell, project.color, stateCls);
		});
	}

	private renderBar(td: HTMLTableCellElement, cell: Cell, color: string, stateCls: string): void {
		if (cell.kind === 'blank') return;

		const classes = ['bar'];
		let needsColor = false;
		switch (cell.kind) {
			case 'solid':
				classes.push('bar-solid');
				needsColor = true;
				break;
			case 'settled':
				classes.push('bar-solid', 'bar-settled');
				needsColor = true;
				break;
			case 'overflow':
				classes.push('bar-overflow');
				break;
			case 'dashed':
				classes.push('bar-dashed');
				needsColor = true;
				break;
			case 'span-dashed':
				classes.push('bar-dashed', 'bar-span');
				needsColor = true;
				break;
			case 'span-solid':
				classes.push('bar-solid', 'bar-span');
				needsColor = true;
				break;
		}
		if (stateCls) classes.push(stateCls);

		const bar = td.createDiv({ cls: classes.join(' '), attr: { title: cell.tooltip } });
		if (needsColor) bar.setCssProps({ '--pd-cat-color': color });
		if (cell.spanWeeks > 1) bar.setCssProps({ '--pd-span': String(cell.spanWeeks) });
	}
}
