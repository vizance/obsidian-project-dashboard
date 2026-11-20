import { ItemView, MarkdownView, Scope, TFile, type WorkspaceLeaf } from 'obsidian';
import { CATEGORIES, CATEGORY_KEYS } from './core/config';
import type { Cell } from './core/cells';
import { calendarLabel, calendarStatusLine, monthEventRange } from './core/calendar-row';
import { eventLineText, occurrencesForWeek, occurrencesInRange, type EventOccurrence } from './core/calendar';
import { sortProjects, spanWeekOffset, visibleProjects, yearViewCells } from './core/cells';
import {
	monthOfDate,
	monthTitle,
	monthWhenEnteringMonthView,
	shiftMonth,
	unscheduledWeekOptions,
	weeksOfMonth,
	yearWhenEnteringYearView,
	type MonthRef,
} from './core/months';
import {
	applyCategoryOverride,
	clampProjColWidth,
	parseCategoryOrder,
	parsePinnedCategory,
	parseProjColWidth,
	parseScale,
	parseViewMode,
	resolveInitialHelpPanel,
} from './core/prefs';
import { placePopover } from './core/popover-position';
import { detectStatus, filenameWithStatus, type ProjectRecord, type ProjectStatus } from './core/scan';
import {
	locateLine,
	scheduleDateForWeek,
	taskLinesForWeek,
	unscheduledTasks,
	type TaskLine,
} from './core/task-lines';
import type { DashboardSettings } from './core/settings';
import { buildWeeks, groupMonths, groupQuarters, todayLocal, todayWeekIndex, type WeekInfo } from './core/weeks';
import type ProjectDashboardPlugin from './main';
import { MonthView, type CalendarRowData } from './month-view';
import { projectStateClass, renderProjectColHeader, renderProjectHeadCell } from './project-column';
import { TaskWriter, type TaskEdit } from './task-writer';
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

// 浮窗用目標的辨識資料，不用元素本身 — 每次重繪都會換掉整張表。兩種浮窗共用同一個
// 元素，所以目標也只有一個欄位，用 kind 分：週浮窗是「筆記路徑 + ISO 週」，月視圖
// 「還沒排」欄打開的浮窗是「筆記路徑」（它不屬於任何一週）。
interface WeekTarget {
	kind: 'week';
	path: string;
	week: string;
}

interface UnscheduledTarget {
	kind: 'unscheduled';
	path: string;
}

type PopoverTarget = WeekTarget | UnscheduledTarget;

// 重繪前記下來、重繪後放回去的畫面狀態（dashboard-note-sync：Re-render preserves
// the user's view state）。年／月、顯示的年份與月份、各種開關都在欄位裡，重繪不會動到。
interface PreservedViewState {
	scrollLeft: number;
	scrollTop: number;
	popover: (PopoverTarget & { state: PopoverViewState }) | null;
}

// 同一個目標嗎（同一格再點一次要關閉、非同步打開筆記後要確認浮窗還是原來那個）。
function sameTarget(a: PopoverTarget | null, b: PopoverTarget): boolean {
	if (!a || a.kind !== b.kind) return false;
	if (a.kind === 'week' && b.kind === 'week') return a.path === b.path && a.week === b.week;
	return a.path === b.path;
}

export class ProjectDashboardView extends ItemView {
	private today = '';
	private viewMode: 'per-week' | 'timeline' = 'per-week';
	private scale: 'year' | 'month' = 'year';
	// 顯示中的期間只放在記憶體，重開分頁才回到今天，重繪保留正在規劃的期間。
	private shownYear = 1970;
	private shownMonth: MonthRef = { year: 1970, month: 1 };
	private categoryOrder: string[] = [];
	private pinnedCategory: string | null = null;
	private projColWidth = 280;
	private showClosed = false;
	private showPaused = false;
	private helpPanelOpen = false;
	private popoverAnchor: HTMLElement | null = null;
	private popoverTarget: PopoverTarget | null = null;
	private unbindWeekPopoverWindowListeners: (() => void) | null = null;
	// Restoring scroll after a re-render fires scroll events on the next frame;
	// they must not close the popover that was just re-opened.
	private suppressScrollCloseUntil = 0;
	private toastTimer: number | null = null;
	private noteLeaf: WorkspaceLeaf | null = null;
	private unsubscribeVaultSource: (() => void) | null = null;
	private unsubscribeStore: (() => void) | null = null;
	private unsubscribeCalendars: (() => void) | null = null;
	// 每次 CalendarStore 通知（讀取開始或結束）就加一，用來讓展開結果的快取失效。
	// 不能用 state 物件的識別：每次讀 state 都是新的快照。
	private calendarVersion = 0;
	// 展開一個月的行程對大型行事曆來說不便宜，所以只在讀取有新結果或顯示的月份換掉
	// 時才重算；筆記變動造成的重繪沿用這一份（design.md：切換月份不重新解析）。
	private calendarCache: { version: number; from: string; to: string; occurrences: EventOccurrence[] } | null = null;

	private projects: ProjectRecord[] = [];
	private weeks: WeekInfo[] = [];
	// 月視圖那個月的週。年視圖的 this.weeks 是顯示中的年份，所以兩份分開放。
	private monthWeeks: WeekInfo[] = [];
	private missingFolderMessage: string | null = null;
	private popover!: WeekPopover;
	private monthView!: MonthView;
	private taskWriter!: TaskWriter;

	private metaEl!: HTMLElement;
	private legendEl!: HTMLElement;
	private chartEl!: HTMLElement;
	private showPausedLabel!: HTMLLabelElement;
	private showPausedText!: HTMLElement;
	private scaleYearBtn!: HTMLButtonElement;
	private scaleMonthBtn!: HTMLButtonElement;
	private monthNavEl!: HTMLElement;
	private monthTitleEl!: HTMLElement;
	private periodPrevBtn!: HTMLButtonElement;
	private periodNextBtn!: HTMLButtonElement;
	private periodCurrentBtn!: HTMLButtonElement;
	private periodCurrentEl!: HTMLElement;
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

	// 每次要用的時候才讀：設定可能在分頁開著的時候被改掉或同步進來。
	private get settings(): DashboardSettings {
		return this.plugin.store.data.settings;
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
		// 讀取開始（狀態列要顯示「讀取中…」）與結束都重繪，但不重新掃描筆記
		// （design.md：行事曆更新走保留狀態的重繪）。先訂閱再讀取，第一次讀取的
		// 開始通知才不會漏掉。
		this.unsubscribeCalendars = this.plugin.calendars.subscribe(() => {
			this.calendarVersion += 1;
			this.renderPreservingPopover();
		});
		// 分頁打開是四種讀取時機之一；沒有行事曆設鑰匙時這一次完全不連網。
		void this.plugin.calendars.refresh();
		this.unsubscribeVaultSource = this.vaultSource.onChange(() => {
			void this.handleExternalChange();
		});
		// 設定存檔成功或外部重新載入後，用同一條保留畫面狀態的路徑重掃、重繪，
		// 分頁不用重開（dashboard-settings：Settings changes apply to open dashboards）。
		this.unsubscribeStore = this.plugin.store.subscribe((reason) => {
			if (reason !== 'settings-saved' && reason !== 'reloaded') return;
			void this.handleExternalChange();
		});
	}

	async onClose(): Promise<void> {
		this.unsubscribeVaultSource?.();
		this.unsubscribeVaultSource = null;
		this.unsubscribeStore?.();
		this.unsubscribeStore = null;
		this.unsubscribeCalendars?.();
		this.unsubscribeCalendars = null;
		// 浮窗不在 contentEl 裡，empty() 清不掉它，要自己移除。
		this.popoverEl?.remove();
		this.contentEl.empty();
	}

	// Triggered by vault-source's debounced re-scan notification and by a settings
	// change or outside reload (design.md: "重繪時保留畫面狀態") — rebuild only
	// stats/legend/chart, restore scroll, and re-open the popover on the new cell
	// for the same project and week.
	private async handleExternalChange(): Promise<void> {
		this.today = todayLocal();
		await this.refreshPreservingPopover();
	}

	// Shared by the debounced vault change and the immediate re-scan after a
	// stale/invalid edit (dashboard-note-sync: "The same rule SHALL apply to the
	// immediate re-scan"). renderChart() closes the popover because every anchor
	// is replaced, so the target is captured before and re-opened after.
	private async refreshPreservingPopover(): Promise<void> {
		const preserved = this.capturePreservedState();
		await this.rescanAndRender();
		this.restorePreservedState(preserved);
	}

	// 行事曆讀取開始與結束走這一條：畫面狀態與浮窗的處理和筆記變動完全相同，只是
	// 不重新掃描筆記（dashboard-note-sync：A calendar fetch keeps the popover open）。
	private renderPreservingPopover(): void {
		const preserved = this.capturePreservedState();
		this.render();
		this.restorePreservedState(preserved);
	}

	private capturePreservedState(): PreservedViewState {
		return {
			scrollLeft: this.chartEl.scrollLeft,
			scrollTop: this.contentEl.scrollTop,
			popover: this.popoverTarget ? { ...this.popoverTarget, state: this.popover.captureState() } : null,
		};
	}

	private restorePreservedState(preserved: PreservedViewState): void {
		this.chartEl.scrollLeft = preserved.scrollLeft;
		this.contentEl.scrollTop = preserved.scrollTop;
		if (!preserved.popover) return;
		this.suppressScrollCloseUntil = Date.now() + SCROLL_RESTORE_GRACE_MS;
		this.reopenPopover(preserved.popover);
	}

	// Later tasks call this after a background re-scan; rebuilds the stats,
	// legend, and chart only (design.md: "重繪時保留畫面狀態" keeps the controls row).
	render(): void {
		this.updatePausedControl();
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
		this.scale = parseScale(this.readLocalStorage('dashboard.scale'));
		// 期間不存進偏好，分頁開啟時一律從今年或本月開始。
		this.shownYear = Number(this.today.slice(0, 4));
		this.shownMonth = monthOfDate(this.today);
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
		this.contentEl.removeClass('editing-categories');
		this.showClosed = false;
		this.showPaused = false;
		this.contentEl.setCssProps({ '--proj-col-width': `${this.projColWidth}px` });

		const header = this.contentEl.createEl('header');
		header.createEl('h1', { text: '專案總覽' });
		this.metaEl = header.createSpan({ cls: 'meta' });
		this.legendEl = header.createDiv({ cls: 'legend' });

		const controls = this.contentEl.createDiv({ cls: 'controls' });
		const showClosedLabel = controls.createEl('label');
		const showClosedInput = showClosedLabel.createEl('input', { attr: { type: 'checkbox', id: 'show-closed' } });
		showClosedLabel.appendText('顯示已結案（已完成 + 取消）');
		this.showPausedLabel = controls.createEl('label');
		this.showPausedLabel.hidden = true;
		const showPausedInput = this.showPausedLabel.createEl('input', { attr: { type: 'checkbox', id: 'show-paused' } });
		this.showPausedText = this.showPausedLabel.createSpan();
		this.registerDomEvent(showPausedInput, 'change', () => {
			this.showPaused = showPausedInput.checked;
			this.renderChart();
		});
		const editCategoriesLabel = controls.createEl('label');
		const editCategoriesInput = editCategoriesLabel.createEl('input', { attr: { type: 'checkbox', id: 'edit-categories' } });
		editCategoriesLabel.appendText('編輯分類與狀態');

		this.registerDomEvent(showClosedInput, 'change', () => {
			this.showClosed = showClosedInput.checked;
			this.renderChart();
		});
		this.registerDomEvent(editCategoriesInput, 'change', () => {
			this.contentEl.toggleClass('editing-categories', editCategoriesInput.checked);
		});

		this.buildScaleControls(controls);

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
				date: scheduleDateForWeek(target.week, this.settings),
			})),
			// 還沒排浮窗的週按鈕：日期一樣走 scheduleDateForWeek，只是週數來自按鈕，
			// 所以 stale 處理與錯誤訊息和週浮窗挑任務完全相同。
			scheduleInto: (line, weekLabel) => this.runUnscheduledEdit((target) => ({
				kind: 'schedule',
				path: target.path,
				line: line.line,
				raw: line.raw,
				date: scheduleDateForWeek(weekLabel, this.settings),
			})),
			addTask: (text) => this.runPopoverEdit((target) => ({
				kind: 'add',
				path: target.path,
				text,
				date: scheduleDateForWeek(target.week, this.settings),
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
			// 浮窗透過 host 拿目前的週六規則（design.md：浮窗透過 host 拿目前的設定）。
			weekRules: () => this.settings,
		});

		this.toastEl = this.contentEl.createDiv({ attr: { id: 'toast', role: 'status', 'aria-live': 'polite' } });
		this.toastEl.hidden = true;

		// 月視圖透過 host 介面拿資料：篩選、排序、設定、今天的日期都還是 view 說了算。
		this.monthView = new MonthView({
			projects: () => this.visibleSortedProjects(),
			weeks: () => this.monthWeeks,
			settings: () => this.settings,
			today: () => this.today,
			categoryOrder: () => this.categoryOrder,
			calendarRow: () => this.calendarRowData(),
		});

		this.setHelpPanelVisible(this.helpPanelOpen);
	}

	// 控制列的「年／月」切換與期間導覽。元素只建一次，之後只改文字與顯示與否，
	// 重繪圖表不會動到控制列（design.md：重繪時保留畫面狀態）。
	private buildScaleControls(controls: HTMLElement): void {
		const scaleSwitch = controls.createDiv({ cls: 'scale-switch', attr: { role: 'group', 'aria-label': '年或月視圖' } });
		this.scaleYearBtn = scaleSwitch.createEl('button', {
			cls: 'scale-option',
			text: '年',
			attr: { type: 'button', title: '年視圖' },
		});
		this.scaleMonthBtn = scaleSwitch.createEl('button', {
			cls: 'scale-option',
			text: '月',
			attr: { type: 'button', title: '月視圖' },
		});
		this.registerDomEvent(this.scaleYearBtn, 'click', () => this.setScale('year'));
		this.registerDomEvent(this.scaleMonthBtn, 'click', () => this.setScale('month'));

		this.monthNavEl = controls.createDiv({ cls: 'month-nav' });
		this.periodPrevBtn = this.monthNavEl.createEl('button', {
			cls: 'month-nav-btn',
			text: '◀',
			attr: { type: 'button', title: '上一個月' },
		});
		this.monthTitleEl = this.monthNavEl.createSpan({ cls: 'month-title' });
		this.periodNextBtn = this.monthNavEl.createEl('button', {
			cls: 'month-nav-btn',
			text: '▶',
			attr: { type: 'button', title: '下一個月' },
		});
		// 沿用 month-nav[hidden] 的顯示規則，避免 Obsidian 的按鈕 display 蓋過 hidden。
		this.periodCurrentEl = this.monthNavEl.createSpan({ cls: 'month-nav' });
		this.periodCurrentBtn = this.periodCurrentEl.createEl('button', {
			cls: 'month-nav-btn',
			text: '本月',
			attr: { type: 'button', title: '回到今天這週所屬的月份' },
		});
		this.registerDomEvent(this.periodPrevBtn, 'click', () => this.shiftPeriod(-1));
		this.registerDomEvent(this.periodNextBtn, 'click', () => this.shiftPeriod(1));
		this.registerDomEvent(this.periodCurrentBtn, 'click', () => {
			if (this.scale === 'month') this.showMonth(monthOfDate(this.today));
			else this.showYear(Number(this.today.slice(0, 4)));
		});

		this.updateScaleControls();
	}

	private setScale(next: 'year' | 'month'): void {
		if (this.scale === next) return;
		this.scale = next;
		if (next === 'month') this.shownMonth = monthWhenEnteringMonthView(this.shownYear, this.today);
		else this.shownYear = yearWhenEnteringYearView(this.shownMonth);
		this.writeLocalStorage('dashboard.scale', next);
		// renderChart 會關掉浮窗，切換年／月之後沒有任何路徑會再把它打開。
		this.renderChart();
	}

	private showMonth(ref: MonthRef): void {
		this.shownMonth = ref;
		this.renderChart();
	}

	private showYear(year: number): void {
		this.shownYear = year;
		this.renderChart();
	}

	private shiftPeriod(delta: number): void {
		if (this.scale === 'month') this.showMonth(shiftMonth(this.shownMonth, delta));
		else this.showYear(this.shownYear + delta);
	}

	private updateScaleControls(): void {
		const isMonth = this.scale === 'month';
		this.scaleYearBtn.toggleClass('active', !isMonth);
		this.scaleMonthBtn.toggleClass('active', isMonth);
		this.scaleYearBtn.setAttribute('aria-pressed', String(!isMonth));
		this.scaleMonthBtn.setAttribute('aria-pressed', String(isMonth));
		this.periodPrevBtn.setAttribute('title', isMonth ? '上一個月' : '上一年');
		this.periodNextBtn.setAttribute('title', isMonth ? '下一個月' : '下一年');
		this.periodCurrentBtn.setText(isMonth ? '本月' : '今年');
		this.periodCurrentBtn.setAttribute('title', isMonth ? '回到今天這週所屬的月份' : '回到今年');
		if (isMonth) {
			const { year, month } = this.shownMonth;
			const current = monthOfDate(this.today);
			this.monthTitleEl.setText(monthTitle(year, month, weeksOfMonth(year, month)));
			this.periodCurrentEl.hidden = year === current.year && month === current.month;
		} else {
			this.monthTitleEl.setText(`${this.shownYear} 年`);
			this.periodCurrentEl.hidden = this.shownYear === Number(this.today.slice(0, 4));
		}
	}

	private buildHelpPanel(): void {
		this.helpPanelEl = this.contentEl.createDiv({
			attr: { id: 'help-panel', 'aria-label': '快捷鍵與圖示說明' },
		});
		const closeBtn = this.helpPanelEl.createEl('button', {
			cls: 'close-btn',
			attr: { id: 'help-close', type: 'button', title: '關閉（也可按 ? 切換）', 'aria-label': '關閉說明面板' },
			text: '×',
		});
		this.registerDomEvent(closeBtn, 'click', () => this.toggleHelpPanel(false));

		const tabList = this.helpPanelEl.createDiv({ cls: 'help-tabs', attr: { role: 'tablist', 'aria-label': '說明分類' } });
		const tabs = [
			{ key: 'year', label: '年視圖' },
			{ key: 'month', label: '月視圖' },
			{ key: 'actions', label: '操作' },
		];
		const panels = tabs.map(({ key, label }, index) => {
			const selected = key === (this.scale === 'month' ? 'month' : 'year');
			const tabId = `help-tab-${key}`;
			const panelId = `help-content-${key}`;
			const tab = tabList.createEl('button', {
				text: label,
				attr: { type: 'button', id: tabId, role: 'tab', 'aria-selected': String(selected), 'aria-controls': panelId, tabindex: selected ? '0' : '-1' },
			});
			const panel = this.helpPanelEl.createDiv({
				cls: 'help-tabpanel',
				attr: { id: panelId, role: 'tabpanel', 'aria-labelledby': tabId, tabindex: '0' },
			});
			panel.hidden = !selected;
			this.registerDomEvent(tab, 'click', () => this.selectHelpTab(tabId));
			this.registerDomEvent(tab, 'keydown', (event: KeyboardEvent) => {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
				event.preventDefault();
				const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
				this.selectHelpTab(`help-tab-${tabs[next]!.key}`, true);
			});
			return panel;
		});
		const yearPanel = panels[0]!;
		const monthPanel = panels[1]!;
		const actionsPanel = panels[2]!;
		const addGroup = (panel: HTMLElement, heading: string): HTMLUListElement => {
			const group = panel.createEl('section', { cls: 'help-group' });
			group.createEl('h4', { text: heading });
			return group.createEl('ul');
		};
		const addVisualRow = (list: HTMLElement, explanation: string): HTMLElement => {
			const li = list.createEl('li', { cls: 'help-visual-row' });
			const sample = li.createDiv({ cls: 'help-sample', attr: { 'aria-hidden': 'true' } });
			li.createDiv({ cls: 'help-description', text: explanation });
			return sample;
		};
		const addLegendRow = (list: HTMLElement, swatchCls: string, explanation: string, rowCls = ''): HTMLTableCellElement => {
			const sample = addVisualRow(list, explanation).createEl('table', { cls: 'legend-sample' });
			// 真正的列與儲存格讓暫停、今天欄與名稱標記沿用圖表樣式。
			sample.setCssProps({ '--pd-cat-color': '#3B82F6' });
			const row = sample.createEl('tbody').createEl('tr', { cls: rowCls });
			const cell = row.createEl('td', { cls: 'proj-cell' });
			if (swatchCls) cell.createSpan({ cls: `swatch ${swatchCls}` });
			return cell;
		};

		const tasks = addGroup(yearPanel, '每一格＝這週的任務');
		addLegendRow(tasks, 'bar bar-solid', '有任務，還沒全部完成');
		addLegendRow(tasks, 'bar bar-solid bar-settled', '這週的任務都完成了');
		addLegendRow(tasks, 'bar bar-dashed', '在專案期間內，這週沒有任務');
		addLegendRow(tasks, 'blank', '沒有任務，也不在專案期間（或專案已結案）');

		const attention = addGroup(yearPanel, '需要注意');
		addLegendRow(attention, 'bar bar-overflow', '超出預計結束日期還有任務；可以更新 frontmatter 的 預計結束日期');
		const warning = addLegendRow(attention, '', '日期有缺漏、是推算的，或有問題；滑過去看原因');
		warning.appendText('專案');
		warning.createSpan({ cls: 'warn', text: '⚠' });

		const status = addGroup(yearPanel, '整列＝專案狀態');
		const paused = addLegendRow(status, 'bar bar-solid', '暫停的專案（勾「顯示暫停」才會出現）', 'status-pending');
		paused.createSpan({ cls: 'pause-badge', text: '⏳ 暫停' });
		addLegendRow(status, 'bar bar-solid done', '已完成或取消的專案（勾「顯示已結案」才會出現）');

		const columns = addGroup(yearPanel, '顏色與欄位');
		addLegendRow(columns, '', '專案的分類，對照上方圖例').createSpan({ cls: 'cat-dot' });
		addLegendRow(columns, 'today-sample', '今天所在的週').addClass('today-col');

		const taskText = addGroup(monthPanel, '格子裡的任務文字');
		for (const [cls, sample, explanation] of [
			['mc-done', '✓ 任務', '已完成的任務'],
			['mc-overdue', '任務', '週已過還沒完成的任務'],
			['mc-open', '任務', '還沒完成、週還沒過的任務'],
		] as const) addVisualRow(taskText, explanation).createSpan({ cls, text: sample });
		addGroup(monthPanel, '格子底色').createEl('li', { text: '底色的意思和年視圖一樣（實心、淡色、虛線、紅色、斜線紋）' });
		const calendar = addGroup(monthPanel, 'General 列（行事曆）');
		addVisualRow(calendar, '行事曆名稱；顏色在設定頁改')
			.createSpan({ cls: 'gc-label', text: '行事曆' }).setCssProps({ '--pd-calendar-color': '#4a7fd4' });
		addVisualRow(calendar, '重新讀取行事曆；行程只能看，不能改').createSpan({ cls: 'general-refresh', text: '↻' });
		const unscheduled = addGroup(monthPanel, '還沒排');
		addVisualRow(unscheduled, '還沒排日期的任務；點一下排進這個月的某一週')
			.createSpan({ cls: 'help-unscheduled-count', text: '3' });

		const editing = addGroup(actionsPanel, '編輯');
		for (const text of [
			'點格子 → 打開那一週的任務：勾完成、換週、排進或新增任務',
			'點專案名稱 → 在右側開啟筆記',
			'勾「編輯分類與狀態」 → 改專案的分類，或改成暫停、完成、取消',
		]) editing.createEl('li', { text });
		const switching = addGroup(actionsPanel, '切換');
		const scale = switching.createEl('li');
		scale.createSpan({ text: '年 / 月，或按 ' });
		scale.createEl('kbd', { text: 'M' });
		scale.createSpan({ text: ' → 切換年視圖與月視圖' });
		switching.createEl('li', { text: '◀ ▶ → 換年份或月份；今年、本月 回到現在' });
		const timeline = switching.createEl('li');
		timeline.createEl('kbd', { text: 'T' });
		timeline.createSpan({ text: ' → 切換逐週與 Timeline（只在年視圖）' });
		const help = switching.createEl('li');
		help.createEl('kbd', { text: '?' });
		help.createSpan({ text: ' → 打開或關閉這個面板' });
		const layout = addGroup(actionsPanel, '版面');
		layout.createEl('li', { text: '點圖例 → 把一類置頂；拖拉圖例 → 調整分類順序' });
		layout.createEl('li', { text: '拖拉專案欄的右邊 → 調整欄寬' });
	}

	private selectHelpTab(tabId: string, focus = false): void {
		this.helpPanelEl.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((tab) => {
			const selected = tab.getAttribute('id') === tabId;
			tab.setAttribute('aria-selected', String(selected));
			tab.setAttribute('tabindex', selected ? '0' : '-1');
			if (selected && focus) tab.focus();
		});
		this.helpPanelEl.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((panel) => {
			panel.hidden = panel.getAttribute('aria-labelledby') !== tabId;
		});
	}

	private registerInteractions(): void {
		this.registerLegendDrag();
		this.registerResizeHandle();
		this.registerCategoryOverride();
		this.registerStatusChange();
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
			// 視圖模式只作用在年視圖：月視圖按 T 什麼都不做，也不寫 dashboard.viewMode
			// （dashboard-keyboard-shortcuts：T does nothing in the month view）。
			if (this.scale === 'month') return true;
			this.viewMode = this.viewMode === 'timeline' ? 'per-week' : 'timeline';
			this.writeLocalStorage('dashboard.viewMode', this.viewMode);
			this.renderChart();
			return false;
		};
		const toggleScale = (evt: KeyboardEvent): boolean => {
			if (this.shouldIgnoreShortcut(evt)) return true;
			this.setScale(this.scale === 'month' ? 'year' : 'month');
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
		scope.register([], 'm', toggleScale);
		scope.register([], 'M', toggleScale); // caps lock: capital M without the Shift flag
		scope.register(['Shift'], 'M', toggleScale);
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
		if (visible) this.selectHelpTab(this.scale === 'month' ? 'help-tab-month' : 'help-tab-year');
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

			const doc = this.containerEl.ownerDocument;
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
				const hovered = (doc.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)
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
				doc.removeEventListener('mousemove', onMove);
				doc.removeEventListener('mouseup', onUp);
				item.classList.remove('dragging');
				if (dropTargetEl) dropTargetEl.classList.remove('drop-target');

				if (!dragging) {
					this.pinnedCategory = this.pinnedCategory === draggedKey ? null : draggedKey;
					this.writeLocalStorage('dashboard.pinnedCategory', JSON.stringify(this.pinnedCategory));
					this.render();
					return;
				}

				const dropEl = (doc.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)
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

			this.registerDomEvent(doc, 'mousemove', onMove);
			this.registerDomEvent(doc, 'mouseup', onUp);
		});
	}

	private registerResizeHandle(): void {
		this.registerDomEvent(this.chartEl, 'mousedown', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.classList.contains('resize-handle')) return;
			const doc = this.containerEl.ownerDocument;
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
				doc.removeEventListener('mousemove', onMove);
				doc.removeEventListener('mouseup', onUp);
				this.contentEl.removeClass('col-resizing');
				target.classList.remove('dragging');
				this.writeLocalStorage('dashboard.projColWidth', String(Math.round(this.projColWidth)));
			};

			this.registerDomEvent(doc, 'mousemove', onMove);
			this.registerDomEvent(doc, 'mouseup', onUp);
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
		const result = applyCategoryOverride(this.plugin.store.data.categoryOverrides, project, category, CATEGORY_KEYS);
		if (!result.ok) return;

		try {
			// 整份外掛資料一次寫進去，設定不會被蓋掉（dashboard-settings：
			// Saving one part of plugin data keeps the other）。
			await this.plugin.store.saveCategoryOverrides(result.overrides);
			this.showToast('已更新分類');
			await this.rescanAndRender();
		} catch (err) {
			console.error('[project-dashboard] 儲存分類覆寫失敗', err);
			this.showToast('分類儲存失敗，請再試一次', true);
			this.renderChart();
		}
	}

	private registerStatusChange(): void {
		this.registerDomEvent(this.chartEl, 'change', (e: Event) => {
			const select = e.target as HTMLSelectElement;
			if (!select.classList?.contains('status-select')) return;
			void this.handleStatusChange(select);
		});
	}

	private async handleStatusChange(select: HTMLSelectElement): Promise<void> {
		const project = this.projects.find((p) => p.path === select.dataset.path);
		if (!project || select.disabled) return;
		const status = select.value as ProjectStatus;
		if (!['active', 'pending', 'done', 'cancelled'].includes(status)) return;
		const file = this.app.vault.getAbstractFileByPath(project.path);
		if (!(file instanceof TFile)) {
			select.value = project.status;
			this.showToast(MSG_MISSING_FILE, true);
			return;
		}
		const currentStatus = detectStatus(file.name);
		if (status === currentStatus) return;
		const folder = file.path.slice(0, file.path.lastIndexOf('/') + 1);
		const newPath = folder + filenameWithStatus(file.name, status);
		if (this.app.vault.getAbstractFileByPath(newPath)) {
			select.value = currentStatus;
			this.showToast('已經有同名的筆記，狀態沒有改', true);
			return;
		}
		// 等待改名時先停用，避免連續選擇讓兩次改名互相覆蓋。
		select.disabled = true;
		try {
			await this.app.fileManager.renameFile(file, newPath);
		} catch {
			select.value = currentStatus;
			this.showToast('狀態沒有改，請再試一次', true);
		} finally {
			select.disabled = false;
		}
	}

	// design.md: "在右側分割開啟筆記並重複使用" — clicking a project name opens its
	// note in a split to the right, reusing that split while it is still attached.
	private registerProjectNameClick(): void {
		this.registerDomEvent(this.chartEl, 'click', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest('.cat-select, .status-select')) return;
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
		this.bindWeekPopoverWindowListeners(this.containerEl.ownerDocument);
		this.register(this.containerEl.onWindowMigrated((win) => {
			this.bindWeekPopoverWindowListeners(win.document, win);
			this.closeWeekPopover();
			win.document.body.appendChild(this.popoverEl);
		}));
		// Cleanup must use the latest binding because the tab may have changed windows.
		this.register(() => {
			this.unbindWeekPopoverWindowListeners?.();
			this.unbindWeekPopoverWindowListeners = null;
		});
	}

	private bindWeekPopoverWindowListeners(doc: Document, win: Window | null = doc.defaultView): void {
		this.unbindWeekPopoverWindowListeners?.();
		const onClick = (e: MouseEvent): void => {
			// A click handler inside the popover may have rebuilt the popover's DOM
			// before this document-level listener runs, which detaches e.target and
			// would make contains() false. composedPath() still holds the popover,
			// so expanding a footer section never closes the popover itself.
			if (!this.popoverEl.hidden && e.composedPath().includes(this.popoverEl)) return;
			const target = e.target as HTMLElement;
			if (target.closest?.('.status-select')) return;
			// 點到哪裡依目前顯示的視圖判斷：年視圖找畫出來的色條，月視圖找格子本身
			// （整格可點，包含格子裡的任務文字）。
			if (this.scale === 'month') {
				// General 列的 `↻` 只重新讀取行事曆：它不是格子，也不能關掉開著的浮窗
				// （dashboard-note-sync：A calendar fetch keeps the popover open）。
				if (target.closest && target.closest('.general-refresh')) return;
				const cell = target.closest ? target.closest<HTMLElement>('td.month-cell') : null;
				if (cell && this.handleMonthCellClick(cell)) return;
				// 只有帶 data-path 的「還沒排」格子（數量大於 0）能打開浮窗，表頭與
				// 空格子因此落到下面的關閉分支。
				const unscheduled = target.closest ? target.closest<HTMLElement>('td.month-unscheduled[data-path]') : null;
				if (unscheduled && this.handleUnscheduledCellClick(unscheduled)) return;
				this.closeWeekPopover();
				return;
			}
			const bar = target.closest ? target.closest<HTMLElement>('.bar') : null;
			if (bar && this.handleBarClick(bar, e)) return;
			this.closeWeekPopover();
		};
		const onScroll = (e: Event): void => {
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
		};
		doc.addEventListener('click', onClick);
		win?.addEventListener('scroll', onScroll, true);
		this.unbindWeekPopoverWindowListeners = () => {
			doc.removeEventListener('click', onClick);
			win?.removeEventListener('scroll', onScroll, true);
		};
	}

	// 月視圖的格子：非空白的格子整格都能開浮窗，錨點就是那一格。不看
	// `dashboard.viewMode` — timeline 只作用在年視圖（dashboard-gantt-rendering：
	// The month view SHALL NOT use the timeline rendering）。
	// Returns true when the click was consumed by the popover logic.
	private handleMonthCellClick(cell: HTMLElement): boolean {
		// 空白格沒有這兩個屬性，所以永遠打不開浮窗。
		const path = cell.dataset.path;
		const week = cell.dataset.week;
		if (!path || !week) return false;
		const target: WeekTarget = { kind: 'week', path, week };
		// 同一格再點一次關閉。
		if (sameTarget(this.popoverTarget, target) && !this.popoverEl.hidden) {
			this.closeWeekPopover();
			return true;
		}
		this.openWeekPopover(target, cell, CLOSED_POPOVER_STATE);
		return true;
	}

	// 月視圖「還沒排」欄：數量大於 0 的格子打開還沒排浮窗，錨點就是那一格。
	// Returns true when the click was consumed by the popover logic.
	private handleUnscheduledCellClick(cell: HTMLElement): boolean {
		const path = cell.dataset.path;
		if (!path) return false;
		// 同一格再點一次關閉，和週浮窗相同。
		if (sameTarget(this.popoverTarget, { kind: 'unscheduled', path }) && !this.popoverEl.hidden) {
			this.closeWeekPopover();
			return true;
		}
		this.openUnscheduledPopover(path, cell);
		return true;
	}

	// 年視圖的色條（月視圖走 handleMonthCellClick）。
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
		const target: WeekTarget = { kind: 'week', path, week };
		// 同一格（整條虛線則是同一週）再點一次關閉。
		if (sameTarget(this.popoverTarget, target) && !this.popoverEl.hidden) {
			this.closeWeekPopover();
			return true;
		}
		this.openWeekPopover(target, bar, CLOSED_POPOVER_STATE);
		return true;
	}

	// 年視圖專用：整條虛線要用它蓋住的表格格子來換算週，不能用畫出來的色條：色條
	// 左右各內縮幾個 pixel，用它量會讓剛過格線的點擊落到前一週去。月視圖一週一格，
	// 週直接寫在格子的 data-week 上，不需要換算。
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

	// 年視圖的整條虛線只畫在起始格，所以錨點要換成算出來那一週的表格格子；月視圖
	// 點到的格子本身就是那一週，直接當錨點。
	private anchorForWeek(el: HTMLElement, week: string): HTMLElement {
		if (this.scale === 'month') return el;
		const row = el.closest('tr');
		const index = this.weeks.findIndex((w) => w.label === week);
		if (!row || index === -1) return el;
		return row.querySelectorAll<HTMLElement>('td.week-cell')[index] ?? el;
	}

	// 錨點可能是年視圖的色條，也可能是月視圖的格子，所以超出預計結束日期要兩種都
	// 判斷得出來：年視圖用 `bar-overflow` 這個類別，月視圖用格子的 `data-kind`。
	private isOverflowAnchor(el: HTMLElement): boolean {
		return el.classList.contains('bar-overflow') || el.dataset.kind === 'overflow';
	}

	private openWeekPopover(target: WeekTarget, anchor: HTMLElement, state: PopoverViewState): void {
		const project = this.projects.find((p) => p.path === target.path);
		if (!project) {
			this.closeWeekPopover();
			return;
		}
		this.popover.render({
			projectName: project.name,
			weekLabel: target.week,
			overflowEnd: this.isOverflowAnchor(anchor) ? project.end : null,
			rows: taskLinesForWeek(project.task_lines, target.week, this.settings),
			unscheduled: unscheduledTasks(project.task_lines),
		}, state);
		this.popoverTarget = target;
		this.popoverAnchor = this.anchorForWeek(anchor, target.week);
		this.positionWeekPopover(this.popoverAnchor);
	}

	// 重繪後依浮窗的種類分開重開（重繪不會動到年／月與顯示的期間）。
	private reopenPopover(previous: PopoverTarget & { state: PopoverViewState }): void {
		if (previous.kind === 'unscheduled') {
			this.reopenUnscheduledPopover(previous.path);
			return;
		}
		this.reopenWeekPopover(previous);
	}

	// 還沒排浮窗：月視圖還在、專案列還在、而且還有沒排日期的任務時，在那個專案新的
	// 「還沒排」格子重開；否則關掉。這三個條件剛好等於「找得到帶 data-path 的格子」—
	// 年視圖沒有這一欄，被篩掉的專案沒有這一列，數量 0 的格子沒有 data-path。
	private reopenUnscheduledPopover(path: string): void {
		const cell = this.findUnscheduledCell(path);
		if (!cell) {
			this.closeWeekPopover();
			return;
		}
		this.openUnscheduledPopover(path, cell);
	}

	private openUnscheduledPopover(path: string, anchor: HTMLElement): void {
		const project = this.projects.find((p) => p.path === path);
		const rows = project ? unscheduledTasks(project.task_lines) : [];
		// 一個任務都沒有就沒有東西可排（例如剛排完最後一個），浮窗直接關掉。
		if (!project || rows.length === 0) {
			this.closeWeekPopover();
			return;
		}
		this.popover.renderUnscheduled({
			projectName: project.name,
			rows,
			weeks: unscheduledWeekOptions(project, this.monthWeeks, this.settings),
		});
		this.popoverTarget = { kind: 'unscheduled', path };
		this.popoverAnchor = anchor;
		this.positionWeekPopover(anchor);
	}

	private reopenWeekPopover(previous: WeekTarget & { state: PopoverViewState }): void {
		if (this.scale === 'month') {
			const cell = this.findMonthCell(previous.path, previous.week);
			// 那一格已經不在畫面上（換了月份、專案被篩掉）或變成空白格時關掉。
			if (!cell) {
				this.closeWeekPopover();
				return;
			}
			this.openWeekPopover({ kind: 'week', path: previous.path, week: previous.week }, cell, previous.state);
			return;
		}
		if (this.viewMode !== 'per-week') {
			this.closeWeekPopover();
			return;
		}
		const bar = this.findWeekBar(previous.path, previous.week);
		if (!bar) {
			this.closeWeekPopover();
			return;
		}
		this.openWeekPopover({ kind: 'week', path: previous.path, week: previous.week }, bar, previous.state);
	}

	// 找月視圖裡該專案該週的格子。用格子自己帶的 data-path／data-week 比對，不碰
	// this.weeks（那是年視圖顯示年份的週列表）；空白格沒有這兩個屬性，所以找不到。
	private findMonthCell(path: string, week: string): HTMLElement | null {
		for (const cell of Array.from(this.chartEl.querySelectorAll<HTMLElement>('td.month-cell'))) {
			if (cell.dataset.path === path && cell.dataset.week === week) return cell;
		}
		return null;
	}

	// 找月視圖裡該專案的「還沒排」格子。數量 0 的格子沒有 data-path，所以找不到。
	private findUnscheduledCell(path: string): HTMLElement | null {
		for (const cell of Array.from(this.chartEl.querySelectorAll<HTMLElement>('td.month-unscheduled[data-path]'))) {
			if (cell.dataset.path === path) return cell;
		}
		return null;
	}

	// 找年視圖裡該專案該週畫出來的色條：同一週的格子，或蓋住那一週的整條虛線。
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

	private async runPopoverEdit(build: (target: WeekTarget) => TaskEdit): Promise<WeekPopoverActionResult> {
		const target = this.popoverTarget;
		if (target?.kind !== 'week') return 'restore';
		return this.applyEdit(build(target));
	}

	private async runUnscheduledEdit(
		build: (target: UnscheduledTarget) => TaskEdit,
	): Promise<WeekPopoverActionResult> {
		const target = this.popoverTarget;
		if (target?.kind !== 'unscheduled') return 'restore';
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
		if (!sameTarget(this.popoverTarget, target)) return;
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

	private updatePausedControl(): void {
		const count = visibleProjects(this.projects, true, true).filter((p) => p.status === 'pending').length;
		this.showPausedLabel.hidden = count === 0;
		this.showPausedText.setText(`顯示暫停（${count}）`);
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
		// 今天可能在筆記更新時跨月或跨年，返回按鈕的顯示條件也要跟著更新。
		this.updateScaleControls();
		// 每個錨點都會被換掉，所以先關閉浮窗；需要留著的呼叫端（重繪）會在之後
		// 用 reopenWeekPopover 在新的格子上重開。
		this.closeWeekPopover();
		this.chartEl.empty();
		if (this.missingFolderMessage) {
			this.chartEl.createDiv({ cls: 'empty', text: this.missingFolderMessage });
			return;
		}

		if (this.scale === 'month') this.renderMonthChart();
		else this.renderYearChart();
	}

	private renderMonthChart(): void {
		const { year, month } = this.shownMonth;
		// 月視圖自己算那個月的週，所以可以顯示今年以外的月份（例如 2027 年 1 月）。
		this.monthWeeks = weeksOfMonth(year, month);
		this.monthView.render(this.chartEl);
	}

	// General 列的資料。「有沒有這一列」看目前的設定而不是讀取結果：剛設好行事曆、
	// 還沒讀完時也看得到這一列與它的狀態（dashboard-calendar-row：General row）。
	private calendarRowData(): CalendarRowData | null {
		if (!this.settings.calendars.some((calendar) => calendar.secretId !== '')) return null;
		const range = monthEventRange(this.monthWeeks.map((w) => w.label));
		if (!range) return null;
		const occurrences = this.calendarOccurrences(range.from, range.to);
		return {
			status: calendarStatusLine(this.plugin.calendars.state),
			lines: (weekLabel) => occurrencesForWeek(occurrences, weekLabel).flatMap((occurrence) => {
				// 標籤不讀行程快取裡的名稱，改名或換色後重繪就能直接生效。
				const label = calendarLabel(this.settings.calendars, occurrence.calendarSecretId);
				if (!label) return [];
				return [{ text: eventLineText(occurrence), calendarName: label.name, calendarColor: label.color }];
			}),
			refresh: () => {
				void this.plugin.calendars.refresh();
			},
		};
	}

	// 展開顯示中那個月的行程，並記住上一次的結果：只有讀取帶來新資料（版本加一）或
	// 月份換掉時才重算，筆記變動造成的重繪不會重算。
	private calendarOccurrences(from: string, to: string): EventOccurrence[] {
		const cached = this.calendarCache;
		if (cached && cached.version === this.calendarVersion && cached.from === from && cached.to === to) {
			return cached.occurrences;
		}
		const occurrences = occurrencesInRange(this.plugin.calendars.state.sources, from, to);
		this.calendarCache = { version: this.calendarVersion, from, to, occurrences };
		return occurrences;
	}

	// 與年視圖共用的列：篩選、排序、分組都走這一條，月視圖才會有相同的列與順序。
	private visibleSortedProjects(): ProjectRecord[] {
		return sortProjects(
			visibleProjects(this.projects, this.showClosed, this.showPaused),
			this.categoryOrder,
			this.pinnedCategory,
		);
	}

	private renderYearChart(): void {
		const weeks = buildWeeks(this.shownYear);
		this.weeks = weeks;
		const quarterGroups = groupQuarters(weeks);
		const monthGroups = groupMonths(weeks);
		const todayIdx = this.shownYear === Number(this.today.slice(0, 4)) ? todayWeekIndex(weeks, this.today) : -1;
		const visible = this.visibleSortedProjects();

		const table = this.chartEl.createEl('table', { cls: 'gantt' });
		const thead = table.createEl('thead');

		const quarterRow = thead.createEl('tr');
		renderProjectColHeader(quarterRow, 3);
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
			const tr = tbody.createEl('tr');
			try {
				this.renderProjectRow(tr, project, weeks, todayIdx);
			} catch {
				// 清掉可能已畫出的一部分，避免失敗列仍留下能編輯的任務錨點。
				tr.empty();
				const head = tr.createEl('td', { cls: 'proj-cell' });
				head.createSpan({ cls: 'name', text: project.name, attr: { 'data-path': project.path } });
				head.createSpan({ cls: 'warn', text: '⚠', attr: { title: '這個專案的日期有問題' } });
				for (const [i, w] of weeks.entries()) {
					const borderCls = w.isQuarterStart ? 'q-start' : w.isMonthStart ? 'm-start' : '';
					tr.createEl('td', { cls: ['week-cell', i === todayIdx ? 'today-col' : '', borderCls].filter(Boolean).join(' ') });
				}
				console.error(project.name);
			}
		}
	}

	private renderProjectRow(
		tr: HTMLTableRowElement,
		project: ProjectRecord,
		weeks: WeekInfo[],
		todayIdx: number,
	): void {
		const stateCls = projectStateClass(project);

		renderProjectHeadCell(tr, project, this.categoryOrder);

		const cells = yearViewCells(project, weeks, this.settings, this.viewMode);
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
