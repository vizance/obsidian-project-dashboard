import { ItemView, MarkdownView, Scope, TFile, type WorkspaceLeaf } from 'obsidian';
import { CATEGORIES, CATEGORY_KEYS } from './core/config';
import type { Cell } from './core/cells';
import { perWeekCells, sortProjects, spanWeekOffset, timelineCells, visibleProjects } from './core/cells';
import {
	applyCategoryOverride,
	clampProjColWidth,
	parseCategoryOrder,
	parsePinnedCategory,
	parseProjColWidth,
	parseViewMode,
	resolveInitialHelpPanel,
} from './core/prefs';
import { placePopover } from './core/popover-position';
import type { ProjectRecord } from './core/scan';
import {
	locateLine,
	scheduleDateForWeek,
	taskLinesForWeek,
	unscheduledTasks,
	type TaskLine,
} from './core/task-lines';
import { buildWeeks, groupMonths, groupQuarters, todayLocal, todayWeekIndex, type WeekInfo } from './core/weeks';
import type ProjectDashboardPlugin from './main';
import { TaskWriter, type TaskEdit } from './task-writer';
// TEMPORARY until task 2.2: the view still reads the build-time rules instead of
// the stored settings.
import { TEMPORARY_SETTINGS } from './temporary-settings';
import type { VaultSource } from './vault-source';
import {
	CLOSED_POPOVER_STATE,
	WeekPopover,
	type PopoverViewState,
	type WeekPopoverActionResult,
} from './week-popover';

export const VIEW_TYPE_DASHBOARD = 'project-dashboard-view';

const MONTH_NAMES = [
	'1月', '2月', '3月', '4月', '5月', '6月',
	'7月', '8月', '9月', '10月', '11月', '12月',
];

const LEGEND_DRAG_THRESHOLD = 5;
// Long enough to cover the frame in which programmatic scroll events arrive.
const SCROLL_RESTORE_GRACE_MS = 250;

const MSG_STALE = '這一行在筆記裡剛被改過，畫面已更新，請再試一次';
const MSG_MISSING_FILE = '找不到這則筆記';
const MSG_LINE_NOT_FOUND = '找不到那一行，可能剛被改過';
const MSG_WRITE_FAILED = '寫入筆記失敗，請再試一次';

// 這些 input type 不是文字輸入，Escape 不必讓給它們。
const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];

// 焦點是不是在「打字的地方」。不用 instanceof：浮窗可能在 Obsidian 的獨立視窗裡，
// 那裡的 HTMLInputElement 與主視窗不同，instanceof 會判成 false。
function isTextEntryTarget(target: EventTarget | null): boolean {
	const el = target as (HTMLElement & { type?: string }) | null;
	const tag = el?.tagName;
	if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (el?.isContentEditable) return true;
	if (tag !== 'INPUT') return false;
	const type = (el?.type ?? 'text').toLowerCase();
	return !NON_TEXT_INPUT_TYPES.includes(type);
}

// 浮窗用「筆記路徑 + ISO 週」辨識，不用元素本身 — 每次重繪都會換掉整張表。
interface PopoverTarget {
	path: string;
	week: string;
}

export class ProjectDashboardView extends ItemView {
	private today = '';
	private viewMode: 'per-week' | 'timeline' = 'per-week';
	private categoryOrder: string[] = [];
	private pinnedCategory: string | null = null;
	private projColWidth = 280;
	private showClosed = false;
	private helpPanelOpen = false;
	private popoverAnchor: HTMLElement | null = null;
	private popoverTarget: PopoverTarget | null = null;
	// Restoring scroll after a re-render fires scroll events on the next frame;
	// they must not close the popover that was just re-opened.
	private suppressScrollCloseUntil = 0;
	private toastTimer: number | null = null;
	private noteLeaf: WorkspaceLeaf | null = null;
	private unsubscribeVaultSource: (() => void) | null = null;

	private projects: ProjectRecord[] = [];
	private weeks: WeekInfo[] = [];
	private missingFolderMessage: string | null = null;
	private popover!: WeekPopover;
	private taskWriter!: TaskWriter;

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
		this.taskWriter = new TaskWriter(this.app.vault);
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
		// 浮窗不在 contentEl 裡，empty() 清不掉它，要自己移除。
		this.popoverEl?.remove();
		this.contentEl.empty();
	}

	// Triggered by vault-source's debounced re-scan notification (design.md:
	// "重繪時保留畫面狀態") — rebuild only stats/legend/chart, restore scroll,
	// and re-open the popover on the new cell for the same project and week.
	private async handleVaultChange(): Promise<void> {
		this.today = todayLocal();
		await this.refreshPreservingPopover();
	}

	// Shared by the debounced vault change and the immediate re-scan after a
	// stale/invalid edit (dashboard-note-sync: "The same rule SHALL apply to the
	// immediate re-scan"). renderChart() closes the popover because every anchor
	// is replaced, so the target is captured before and re-opened after.
	private async refreshPreservingPopover(): Promise<void> {
		const scrollLeft = this.chartEl.scrollLeft;
		const scrollTop = this.contentEl.scrollTop;
		const previous = this.popoverTarget ? { ...this.popoverTarget, state: this.popover.captureState() } : null;
		await this.rescanAndRender();
		this.chartEl.scrollLeft = scrollLeft;
		this.contentEl.scrollTop = scrollTop;
		if (previous) {
			this.suppressScrollCloseUntil = Date.now() + SCROLL_RESTORE_GRACE_MS;
			this.reopenWeekPopover(previous);
		}
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

		// 浮窗掛在 document body，不放在分頁裡：Obsidian 的分頁容器是
		// `contain: strict`，會讓 position: fixed 以分頁為基準並把超出的部分裁掉
		// （開著側邊欄或右側分割時浮窗就被切掉）。用 class 而不是 id，因為可能
		// 同時開著兩個儀表板分頁。
		this.popoverEl = this.containerEl.ownerDocument.body.createDiv({
			cls: 'pd-week-popover',
			attr: { role: 'dialog', 'aria-label': '本週任務' },
		});
		this.popoverEl.hidden = true;
		this.popover = new WeekPopover(this.popoverEl, {
			toggle: (line) => this.runPopoverEdit((target) => ({
				kind: 'toggle',
				path: target.path,
				line: line.line,
				raw: line.raw,
				// 用按下去那一刻的本地日期，台北清晨才不會被算成前一天。
				today: todayLocal(),
			})),
			shift: (line, days) => this.runPopoverEdit((target) => ({
				kind: 'shift',
				path: target.path,
				line: line.line,
				raw: line.raw,
				days,
			})),
			schedule: (line) => this.runPopoverEdit((target) => ({
				kind: 'schedule',
				path: target.path,
				line: line.line,
				raw: line.raw,
				date: scheduleDateForWeek(target.week, TEMPORARY_SETTINGS),
			})),
			addTask: (text) => this.runPopoverEdit((target) => ({
				kind: 'add',
				path: target.path,
				text,
				date: scheduleDateForWeek(target.week, TEMPORARY_SETTINGS),
			})),
			jump: (line) => {
				const path = this.popoverTarget?.path;
				if (!path) return;
				this.closeWeekPopover();
				void this.jumpToTaskLine(path, line);
			},
			// 與 `↗` 不同：標題的專案名稱不關浮窗，打開筆記之後再重新定位。
			openNote: () => {
				const target = this.popoverTarget;
				if (!target) return;
				void this.openNoteFromHeader(target);
			},
			onContentResize: () => {
				if (this.popoverAnchor) this.positionWeekPopover(this.popoverAnchor);
			},
		});

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
			// Escape 的讓行條件比 T／?／/ 窄：只有真正在輸入文字時才讓行。任務列的
			// 勾選框點下去就有焦點，那時 Escape 仍要關掉浮窗。
			if (isTextEntryTarget(evt.target)) return true;
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
		await this.openNoteInSplit(path);
	}

	// Shared by the project-name click and the popover's `↗` so both reuse the
	// same note split (dashboard-task-editing: "using the same reuse rule as
	// clicking a project name"). Returns null when the note is gone.
	private async openNoteInSplit(path: string): Promise<WorkspaceLeaf | null> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		const leaf = this.getOrCreateNoteLeaf();
		await leaf.openFile(file);
		return leaf;
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
			// A click handler inside the popover may have rebuilt the popover's DOM
			// before this document-level listener runs, which detaches e.target and
			// would make contains() false. composedPath() still holds the popover,
			// so expanding a footer section never closes the popover itself.
			if (!this.popoverEl.hidden && e.composedPath().includes(this.popoverEl)) return;
			const target = e.target as HTMLElement;
			const bar = target.closest ? target.closest<HTMLElement>('.bar') : null;
			if (bar && this.handleBarClick(bar, e)) return;
			this.closeWeekPopover();
		});
		this.registerDomEvent(activeWindow, 'scroll', (e: Event) => {
			if (this.popoverEl.hidden || !this.popoverAnchor) return;
			if (Date.now() < this.suppressScrollCloseUntil) return;
			// Only a scroll that moves the anchor detaches the fixed-position popover
			// from its cell. Scrolling inside the popover, or in another pane such as
			// the note beside the dashboard (which Obsidian may scroll by itself when
			// our edit lands), must leave it open.
			// Duck typing instead of `instanceof Node`: in a pop-out window the node
			// comes from another realm, where `instanceof` against this window's
			// constructors is always false.
			const node = e.target as { contains?: (other: Node | null) => boolean } | null;
			if (typeof node?.contains !== 'function' || !node.contains(this.popoverAnchor)) return;
			this.closeWeekPopover();
		}, true);
	}

	// Returns true when the click was consumed by the popover logic.
	private handleBarClick(bar: HTMLElement, e: MouseEvent): boolean {
		if (this.viewMode === 'timeline') {
			const title = bar.classList.contains('bar-span') ? bar.getAttribute('title')?.trim() : '';
			if (!title) return false;
			if (this.popoverAnchor === bar && !this.popoverEl.hidden) {
				this.closeWeekPopover();
				return true;
			}
			this.popover.renderText(title);
			this.popoverTarget = null;
			this.popoverAnchor = bar;
			this.positionWeekPopover(bar);
			return true;
		}

		const path = bar.dataset.path;
		const week = this.weekOfBarClick(bar, e.clientX);
		if (!path || !week) return false;
		// 同一格（整條虛線則是同一週）再點一次關閉。
		if (this.popoverTarget?.path === path && this.popoverTarget.week === week && !this.popoverEl.hidden) {
			this.closeWeekPopover();
			return true;
		}
		this.openWeekPopover({ path, week }, bar, CLOSED_POPOVER_STATE);
		return true;
	}

	// 整條虛線要用它蓋住的表格格子來換算週，不能用畫出來的色條：色條左右各內縮
	// 幾個 pixel，用它量會讓剛過格線的點擊落到前一週去。
	private weekOfBarClick(bar: HTMLElement, clientX: number): string | null {
		const spanStart = bar.dataset.spanStart;
		const spanWeeks = bar.dataset.spanWeeks;
		if (spanStart === undefined || spanWeeks === undefined) return bar.dataset.week ?? null;
		const start = Number(spanStart);
		const weeks = Number(spanWeeks);
		const row = bar.closest('tr');
		const cells = row ? Array.from(row.querySelectorAll<HTMLElement>('td.week-cell')) : [];
		const first = cells[start];
		const last = cells[Math.min(start + weeks - 1, cells.length - 1)];
		const firstRect = (first ?? bar).getBoundingClientRect();
		const lastRect = last ? last.getBoundingClientRect() : firstRect;
		const width = first ? lastRect.right - firstRect.left : firstRect.width;
		const offset = spanWeekOffset(clientX - firstRect.left, width, weeks);
		return this.weeks[start + offset]?.label ?? null;
	}

	// 整條虛線只畫在起始格，所以錨點要換成算出來那一週的表格格子。
	private anchorForWeek(bar: HTMLElement, week: string): HTMLElement {
		const row = bar.closest('tr');
		const index = this.weeks.findIndex((w) => w.label === week);
		if (!row || index === -1) return bar;
		return row.querySelectorAll<HTMLElement>('td.week-cell')[index] ?? bar;
	}

	private openWeekPopover(target: PopoverTarget, bar: HTMLElement, state: PopoverViewState): void {
		const project = this.projects.find((p) => p.path === target.path);
		if (!project) {
			this.closeWeekPopover();
			return;
		}
		this.popover.render({
			projectName: project.name,
			weekLabel: target.week,
			overflowEnd: bar.classList.contains('bar-overflow') ? project.end : null,
			rows: taskLinesForWeek(project.task_lines, target.week, TEMPORARY_SETTINGS),
			unscheduled: unscheduledTasks(project.task_lines),
		}, state);
		this.popoverTarget = target;
		this.popoverAnchor = this.anchorForWeek(bar, target.week);
		this.positionWeekPopover(this.popoverAnchor);
	}

	private reopenWeekPopover(previous: PopoverTarget & { state: PopoverViewState }): void {
		if (this.viewMode !== 'per-week') {
			this.closeWeekPopover();
			return;
		}
		const bar = this.findWeekBar(previous.path, previous.week);
		if (!bar) {
			this.closeWeekPopover();
			return;
		}
		this.openWeekPopover({ path: previous.path, week: previous.week }, bar, previous.state);
	}

	// 找該專案該週畫出來的色條：同一週的格子，或蓋住那一週的整條虛線。
	private findWeekBar(path: string, week: string): HTMLElement | null {
		const weekIndex = this.weeks.findIndex((w) => w.label === week);
		for (const bar of Array.from(this.chartEl.querySelectorAll<HTMLElement>('.bar'))) {
			if (bar.dataset.path !== path) continue;
			if (bar.dataset.week === week) return bar;
			const spanStart = bar.dataset.spanStart;
			const spanWeeks = bar.dataset.spanWeeks;
			if (spanStart === undefined || spanWeeks === undefined) continue;
			const start = Number(spanStart);
			if (weekIndex >= start && weekIndex < start + Number(spanWeeks)) return bar;
		}
		return null;
	}

	private closeWeekPopover(): void {
		this.popoverEl.hidden = true;
		this.popoverAnchor = null;
		this.popoverTarget = null;
	}

	private async runPopoverEdit(build: (target: PopoverTarget) => TaskEdit): Promise<WeekPopoverActionResult> {
		const target = this.popoverTarget;
		if (!target) return 'restore';
		return this.applyEdit(build(target));
	}

	// 寫入失敗一律有 toast（Implementation Contract：寫入失敗不靜默）；成功不顯示
	// 訊息，等 vault 事件帶來的重繪當回饋。
	private async applyEdit(edit: TaskEdit): Promise<WeekPopoverActionResult> {
		try {
			const result = await this.taskWriter.apply(edit);
			if (result.status === 'ok') return 'rerender';
			if (result.status === 'missing-file') {
				this.showToast(MSG_MISSING_FILE, true);
				return 'restore';
			}
			this.showToast(MSG_STALE, true);
			await this.refreshPreservingPopover();
			return 'rerender';
		} catch (err) {
			// TaskWriter re-throws a real read/write failure instead of reporting a
			// status, so this is the only place that failure becomes visible.
			console.error('[project-dashboard] 寫入任務失敗', err);
			this.showToast(MSG_WRITE_FAILED, true);
			return 'restore';
		}
	}

	// dashboard-task-editing: 用與點專案名稱相同的分割重用規則打開筆記，選取整行
	// 並捲到畫面中；行已經被改過就照常打開筆記並提示。
	private async jumpToTaskLine(path: string, task: TaskLine): Promise<void> {
		const leaf = await this.openNoteInSplit(path);
		if (!leaf) {
			this.showToast(MSG_MISSING_FILE, true);
			return;
		}
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;
		const editor = view.editor;
		const lines = editor.getValue().split(/\r\n|\r|\n/);
		const index = locateLine(lines, task.line, task.raw);
		if (index === -1) {
			this.showToast(MSG_LINE_NOT_FOUND, true);
			return;
		}
		const from = { line: index, ch: 0 };
		const to = { line: index, ch: lines[index]!.length };
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to }, true);
		// An unfocused editor barely shows its selection; the user asked to go there.
		editor.focus();
	}

	// dashboard-task-editing: 標題的專案名稱用與左欄專案名稱相同的分割重用規則打開
	// 筆記；浮窗留著並重新定位，格子已經捲出儀表板可見範圍時才關閉。
	private async openNoteFromHeader(target: PopoverTarget): Promise<void> {
		const leaf = await this.openNoteInSplit(target.path);
		if (!leaf) {
			this.showToast(MSG_MISSING_FILE, true);
			return;
		}
		// 開筆記是非同步的，這段時間浮窗可能已經被關掉或換成別的專案／週。
		const current = this.popoverTarget;
		if (!current || current.path !== target.path || current.week !== target.week) return;
		const anchor = this.popoverAnchor;
		if (this.popoverEl.hidden || !anchor) return;
		if (!this.isAnchorVisible(anchor)) {
			this.closeWeekPopover();
			return;
		}
		this.positionWeekPopover(anchor);
	}

	// 右側打開筆記會壓窄儀表板，原本的格子可能被擠出圖表的可見範圍。
	private isAnchorVisible(anchor: HTMLElement): boolean {
		const cell = anchor.getBoundingClientRect();
		const chart = this.chartEl.getBoundingClientRect();
		const width = Math.min(cell.right, chart.right) - Math.max(cell.left, chart.left);
		const height = Math.min(cell.bottom, chart.bottom) - Math.max(cell.top, chart.top);
		return width > 0 && height > 0;
	}

	// 固定座標 + 超出邊界就翻面；高度由 styles.css 的 max-height 夾在視窗內，
	// 所以 offsetHeight 量到的已經是夾過的高度。
	private positionWeekPopover(cell: HTMLElement): void {
		// 分頁被拖到 Obsidian 的獨立視窗時，浮窗要跟著搬到那個視窗的 body，
		// 不然它會留在舊視窗裡量不到也看不到。
		const doc = this.containerEl.ownerDocument;
		if (this.popoverEl.ownerDocument !== doc) doc.body.appendChild(this.popoverEl);

		this.popoverEl.hidden = false; // 先顯示才能量到尺寸
		// 先歸零再量：留著上一次靠右邊界的位置，瀏覽器會把浮窗壓窄，量到的寬度
		// 就比實際需要的小，翻面判斷會失準。
		this.popoverEl.setCssProps({ '--pd-popover-left': '0px', '--pd-popover-top': '0px' });
		const win = doc.defaultView ?? activeWindow;
		const { left, top } = placePopover({
			anchor: cell.getBoundingClientRect(),
			size: { width: this.popoverEl.offsetWidth, height: this.popoverEl.offsetHeight },
			pane: this.contentEl.getBoundingClientRect(),
			viewport: { width: win.innerWidth, height: win.innerHeight },
		});
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
		// 每個錨點都會被換掉，所以先關閉浮窗；需要留著的呼叫端（重繪）會在之後
		// 用 reopenWeekPopover 在新的格子上重開。
		this.closeWeekPopover();
		this.chartEl.empty();
		if (this.missingFolderMessage) {
			this.chartEl.createDiv({ cls: 'empty', text: this.missingFolderMessage });
			return;
		}

		const year = Number(this.today.slice(0, 4));
		const weeks = buildWeeks(year);
		this.weeks = weeks;
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

		const cells: Cell[] = this.viewMode === 'timeline'
			? timelineCells(project, weeks)
			: perWeekCells(project, weeks, TEMPORARY_SETTINGS);
		weeks.forEach((w, i) => {
			const cell = cells[i]!;
			const borderCls = w.isQuarterStart ? 'q-start' : w.isMonthStart ? 'm-start' : '';
			const cellCls = ['week-cell', i === todayIdx ? 'today-col' : '', borderCls].filter(Boolean).join(' ');
			const td = tr.createEl('td', { cls: cellCls });
			this.renderBar(td, cell, project, stateCls, w.label, i);
		});
	}

	private renderBar(
		td: HTMLTableCellElement,
		cell: Cell,
		project: ProjectRecord,
		stateCls: string,
		weekLabel: string,
		weekIndex: number,
	): void {
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
		// 每個畫出來的色條都帶路徑與 ISO 週，點擊時才知道要開哪個專案的哪一週；
		// 空白格不畫色條，所以永遠不會打開浮窗。
		bar.dataset.path = project.path;
		bar.dataset.week = weekLabel;
		if (cell.kind === 'span-dashed') {
			bar.dataset.spanStart = String(weekIndex);
			bar.dataset.spanWeeks = String(cell.spanWeeks);
		}
		if (needsColor) bar.setCssProps({ '--pd-cat-color': project.color });
		if (cell.spanWeeks > 1) bar.setCssProps({ '--pd-span': String(cell.spanWeeks) });
	}
}
