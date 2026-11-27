import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { CalendarStore } from '../src/calendar-store';
import type { ProjectRecord } from '../src/core/scan';
import { defaultSettings } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { VaultSource } from '../src/vault-source';
import { ProjectDashboardView } from '../src/view';
import { Platform, Scope, SettingsElement, TFile, TFolder, Vault } from './stubs/obsidian';

function dataKey(attribute: string): string {
	return attribute.slice(5).replace(/-([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());
}
function rectangle(left: number, right: number) {
	return { left, right, top: 0, bottom: 44, width: right - left, height: 44 };
}

function find(el: SettingsElement, predicate: (el: SettingsElement) => boolean): SettingsElement[] {
	return [...(predicate(el) ? [el] : []), ...el.children.flatMap((child) => find(child, predicate))];
}
function byClass(el: SettingsElement, cls: string): SettingsElement[] {
	return find(el, (child) => child.classes.has(cls));
}
function textOf(el: SettingsElement): string {
	return el.textContent + el.children.map(textOf).join('');
}
function required<T>(value: T | null | undefined, description: string): T {
	expect(value, description).toBeDefined();
	expect(value, description).not.toBeNull();
	return value!;
}

// node 沒有版面與事件冒泡；只補這份驗收所需的 DOM，不改共用替身。
function matches(el: SettingsElement, selector: string): boolean {
	return selector.split(',').some((part) => {
		const s = part.trim();
		const tag = /^[a-z]+/i.exec(s)?.[0];
		if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
		const id = /#([\w-]+)/.exec(s)?.[1];
		if (id && el.attributes.get('id') !== id) return false;
		for (const cls of s.matchAll(/\.([\w-]+)/g)) if (!el.classes.has(cls[1]!)) return false;
		for (const attr of s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
			const name = attr[1]!;
			const value = name.startsWith('data-') ? el.dataset[dataKey(name)] : el.attributes.get(name);
			if (value === undefined || (attr[2] !== undefined && value !== attr[2])) return false;
		}
		return true;
	});
}

class Element extends SettingsElement {
	children: Element[] = [];
	parentElement: Element | null = null;
	scrollTop = 0;
	scrollLeft = 0;
	clientWidth = 1100;
	offsetWidth = 300;
	offsetHeight = 200;
	rect = { left: 0, top: 0, right: 1100, bottom: 844 };
	constructor(readonly ownerDocument: TestDocument) { super(); }
	get classList() {
		return {
			contains: (name: string) => this.classes.has(name),
			add: (name: string) => { this.classes.add(name); },
			remove: (name: string) => { this.classes.delete(name); },
		};
	}
	get isConnected(): boolean { return this.ownerDocument.body.contains(this); }
	createEl(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string | number> } = {}): Element {
		const child = new Element(this.ownerDocument);
		child.tagName = tag;
		child.parentElement = this;
		for (const cls of options.cls?.split(' ') ?? []) child.addClass(cls);
		for (const [name, value] of Object.entries(options.attr ?? {})) child.setAttribute(name, String(value));
		child.textContent = options.text ?? '';
		this.children.push(child);
		return child;
	}
	createDiv(options: { cls?: string; text?: string; attr?: Record<string, string | number> } = {}): Element {
		return this.createEl('div', options);
	}
	createSpan(options: { cls?: string; text?: string; attr?: Record<string, string | number> } = {}): Element {
		return this.createEl('span', options);
	}
	getAttribute(name: string): string | null {
		return (name.startsWith('data-') ? this.dataset[dataKey(name)] : this.attributes.get(name)) ?? null;
	}
	querySelectorAll(selector: string): SettingsElement[] {
		return this.children.flatMap((child) => find(child, (entry) => matches(entry, selector)));
	}
	querySelector(selector: string): SettingsElement | null { return this.querySelectorAll(selector)[0] ?? null; }
	closest(selector: string): Element | null {
		return matches(this, selector) ? this : this.parentElement?.closest(selector) ?? null;
	}
	empty(): void {
		for (const child of this.children) child.parentElement = null;
		this.children = [];
		this.textContent = '';
	}
	remove(): void {
		if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
		this.parentElement = null;
	}
	appendChild(child: Element): Element {
		child.remove();
		child.parentElement = this;
		this.children.push(child);
		return child;
	}
	setAttribute(name: string, value: string): void {
		super.setAttribute(name, value);
		if (name.startsWith('data-')) this.dataset[dataKey(name)] = value;
	}
	get scrollWidth(): number {
		return this.attributes.get('id') === 'chart'
			? 280 + yearHeaderColumns(this).reduce((width, column) => width + columnWidth(column), 0)
			: this.clientWidth;
	}
	getBoundingClientRect() {
		// 圖表的右緣跟著 clientWidth，測試才能模擬窗格被拖窄。
		if (this.attributes.get('id') === 'chart') return rectangle(0, this.clientWidth);
		if (this.tagName === 'th' && this.classes.has('proj-col')) return rectangle(0, 280);
		if ((this.tagName === 'th' && this.classes.has('week')) || (this.tagName === 'td' && this.classes.has('week-cell'))) {
			const chart = required(this.closest('#chart'), '週欄所在的 #chart');
			const columns = yearHeaderColumns(chart);
			const header = this.tagName === 'th' ? this : columns.find((el) => el.classes.has('week') && el.dataset.weekIndex === this.dataset.weekIndex);
			const index = columns.indexOf(required(header, '週格對應的表頭'));
			const precedingWidth = columns.slice(0, index).reduce((width, column) => width + columnWidth(column), 0);
			const left = 280 + precedingWidth - chart.scrollLeft;
			return rectangle(left, left + 32);
		}
		return { ...this.rect, width: this.rect.right - this.rect.left, height: this.rect.bottom - this.rect.top };
	}
	focus(): void { this.ownerDocument.activeElement = this; }
	onWindowMigrated(): () => void { return () => {}; }
}

class TestDocument extends EventTarget {
	readonly body = new Element(this);
	readonly defaultView = Object.assign(new EventTarget(), { innerWidth: 1100, innerHeight: 844 });
	activeElement: SettingsElement | null = null;
}


function columnWidth(column: SettingsElement): number {
	return column.classes.has('q-fold-gap') ? 40 : 32;
}

// 月列的 rowspan=2 窄欄也佔週列的空間；依季列 colspan 還原瀏覽器的實際欄序。
function yearHeaderColumns(chart: SettingsElement): SettingsElement[] {
	const table = find(chart, (el) => el.tagName === 'table' && el.classes.has('gantt'))[0];
	if (!table) return [];
	const head = required(find(table, (el) => el.tagName === 'thead')[0], '年表表頭');
	const quarters = byClass(head, 'quarter');
	const gaps = byClass(head, 'q-fold-gap');
	const weeks = find(head, (el) => el.tagName === 'th' && el.classes.has('week'));
	let gapIndex = 0;
	let weekIndex = 0;
	return quarters.flatMap((quarter) => {
		if (quarter.classes.has('q-folded')) return [required(gaps[gapIndex++], '跨月列與週列的窄欄')];
		const count = Number(quarter.attributes.get('colspan'));
		const columns = weeks.slice(weekIndex, weekIndex + count);
		weekIndex += count;
		return columns;
	});
}

interface Note {
	status?: ProjectRecord['status'];
	start?: string;
	end?: string;
	tasks?: string;
}

// 只為送出 Obsidian scope 快捷鍵接觸此欄位；其他驗收都經由 DOM。
interface ViewAccess {
	scope: Scope;
}

const TASK = '- [ ] 準備讀書會 📅 2026-11-20';
const opened: Array<() => Promise<void>> = [];

async function setup(notes: Note[] = [{ tasks: TASK }], mode: 'per-week' | 'timeline' = 'per-week') {
	const settings = { ...defaultSettings(), projectFolder: 'Projects', saturdayCountsAsNextWeek: false };
	const vault = new Vault();
	const folder = new TFolder('Projects');
	vault.setAbstractFile(folder);
	const files = notes.map((note, index) => {
		const prefix = { active: '🚧', pending: '⏳', done: '✅', cancelled: '❌' }[note.status ?? 'active'];
		const file = new TFile(`Projects/${prefix} 範例專案 ${String.fromCharCode(65 + index)}.md`);
		vault.setAbstractFile(file);
		folder.children.push(file);
		vault.setFileContent(file.path, `---\n開始日期: ${note.start ?? '2026-01-01'}\n預計結束日期: ${note.end ?? '2026-12-31'}\n---\n${note.tasks ?? ''}`);
		return file;
	});
	const source = new VaultSource(vault, () => ({}), () => settings);
	source.registerVaultEvents({ registerEvent: vi.fn() });
	const request = vi.fn(async () => ({ status: 200, text: '' }));
	const calendars = new CalendarStore({
		request, getSecret: () => null, now: () => new Date(), calendars: () => settings.calendars, enabled: () => true,
	});
	const doc = new TestDocument();
	const root = doc.body.createDiv();
	const disposers: Array<() => void> = [];
	const leaf = { openFile: vi.fn(async () => {}) };
	const saveLocalStorage = vi.fn();
	const plugin = { store: { data: { settings, categoryOverrides: {} }, subscribe: () => vi.fn() }, calendars };
	const view = new ProjectDashboardView(leaf as unknown as WorkspaceLeaf, source, plugin as unknown as ProjectDashboardPlugin);
	Object.assign(view, {
		app: {
			vault, scope: {}, loadLocalStorage: (key: string) => key === 'dashboard.scale' ? 'year' : key === 'dashboard.viewMode' ? mode : null,
			saveLocalStorage, workspace: { createLeafBySplit: vi.fn(), iterateAllLeaves: vi.fn() },
		},
		leaf, contentEl: root, containerEl: root,
		registerDomEvent: (target: EventTarget, name: string, callback: EventListener) => {
			target.addEventListener(name, callback);
			disposers.push(() => target.removeEventListener(name, callback));
		},
		register: (dispose: () => void) => { disposers.push(dispose); },
	});
	opened.push(async () => {
		await view.onClose();
		for (const dispose of disposers) dispose();
		calendars.dispose();
	});
	await view.onOpen();
	await vi.advanceTimersByTimeAsync(0);
	expect(request).not.toHaveBeenCalled();
	const chart = () => required(find(root, (el) => el.attributes.get('id') === 'chart')[0], '#chart') as Element;
	const table = () => required(find(chart(), (el) => el.tagName === 'table' && el.classes.has('gantt'))[0], 'table.gantt');
	const row = (index = 0) => required(find(table(), (el) => el.tagName === 'tr'
		&& byClass(el, 'name').some((name) => name.dataset.path === files[index]!.path))[0], `專案列 ${index}`);
	const headers = () => find(table(), (el) => el.tagName === 'th' && el.classes.has('week'));
	const heading = (week: number) => required(headers().find((el) => el.textContent === `W${week}`), `W${week} 欄頭`) as Element;
	const popover = () => required(byClass(doc.body, 'pd-week-popover')[0], '.pd-week-popover');
	const title = () => required(byClass(root, 'month-title')[0], '期間標題').textContent;
	const current = () => button(required(byClass(root, 'month-nav')[0], '期間導覽'), '本週');
	const quarters = () => byClass(table(), 'quarter-toggle');
	const pressT = async () => {
		const binding = required((view as unknown as ViewAccess).scope.bindings.find((entry) => entry.key === 'T' && entry.modifiers.length === 0), 'T 快捷鍵');
		expect(binding.callback({ target: null } as unknown as KeyboardEvent)).toBe(false);
		await vi.advanceTimersByTimeAsync(0);
	};
	return { view, root, doc, chart, table, row, headers, heading, popover, title, current, quarters, pressT, vault, files, saveLocalStorage };
}

type Context = Awaited<ReturnType<typeof setup>>;
function button(root: SettingsElement, text: string): SettingsElement {
	return required(find(root, (el) => el.tagName === 'button' && el.textContent === text)[0], `按鈕 ${text}`);
}
function navigation(root: SettingsElement, title: string): SettingsElement {
	return required(byClass(root, 'month-nav-btn').find((el) => el.attributes.get('title') === title), title);
}
function scaleOption(root: SettingsElement, title: string): SettingsElement {
	return required(byClass(root, 'scale-option').find((el) => el.attributes.get('title') === title), title);
}
function hidden(el: SettingsElement): boolean {
	return el.hidden || (el.parentElement ? hidden(el.parentElement) : false);
}
async function click(target: SettingsElement, clientX = 0): Promise<void> {
	const el = target as Element;
	const path: EventTarget[] = [];
	for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) path.push(ancestor);
	path.push(el.ownerDocument);
	// 保留重繪前的路徑，才能把同一次點擊送到圖表與 document 的委派監聽。
	for (const receiver of path) {
		const event = new Event('click', { cancelable: true });
		let stopped = false;
		Object.defineProperties(event, {
			target: { value: el }, clientX: { value: clientX }, composedPath: { value: () => path },
			stopPropagation: { value: () => { stopped = true; } },
			stopImmediatePropagation: { value: () => { stopped = true; Event.prototype.stopImmediatePropagation.call(event); } },
		});
		receiver.dispatchEvent(event);
		if (stopped) break;
	}
	await vi.advanceTimersByTimeAsync(0);
}
function expectDefaultQuarters(c: Context): void {
	expect(c.quarters().map(textOf)).toEqual(['Q1 ▸', 'Q2 ▸', 'Q3 ▸', 'Q4 ▾']);
}
function expectThisWeekVisible(c: Context): void {
	const rect = c.heading(47).getBoundingClientRect();
	expect(rect.left).toBeGreaterThanOrEqual(280);
	expect(rect.right).toBeLessThanOrEqual(1100);
	expect(hidden(c.current())).toBe(true);
}
const weekLabels = (first: number, last: number): string[] => Array.from({ length: last - first + 1 }, (_, index) => `W${first + index}`);

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 10, 20, 12));
	Platform.isPhone = false;
	Platform.isTablet = false;
	vi.stubGlobal('window', {
		setTimeout: (fn: () => void, ms: number) => Number(setTimeout(fn, ms)),
		clearTimeout: (id: number) => clearTimeout(id),
	});
});
afterEach(async () => {
	for (const close of opened.splice(0)) await close();
	Platform.isPhone = false;
	Platform.isTablet = false;
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('year quarter folding', () => {
	// 月份照週一判斷，所以本年的 Q4 實際從 W41 開始；規格範例的 W40 仍屬 Q3。
	it('Past quarters start folded', async () => {
		const c = await setup([{ tasks: TASK }, { tasks: TASK }]);
		expectDefaultQuarters(c);
		expect(c.quarters().map((el) => el.dataset.quarter)).toEqual(['1', '2', '3', '4']);
		expect(c.quarters().map((el) => el.attributes.get('type'))).toEqual(['button', 'button', 'button', 'button']);
		expect(c.quarters().map((el) => el.attributes.get('aria-expanded'))).toEqual(['false', 'false', 'false', 'true']);
		expect(c.quarters().map((el) => el.attributes.get('title'))).toEqual(['展開這一季', '展開這一季', '展開這一季', '折起這一季']);
		for (const toggle of c.quarters()) {
			expect(toggle.parentElement?.tagName).toBe('th');
			expect(toggle.parentElement?.classes.has('quarter')).toBe(true);
		}
		expect(byClass(c.table(), 'q-folded').map((el) => el.attributes.get('colspan'))).toEqual(['1', '1', '1']);
		expect(byClass(c.table(), 'q-fold-gap').map((el) => el.attributes.get('rowspan'))).toEqual(['2', '2', '2']);
		expect(c.headers().map(textOf)).toEqual(weekLabels(41, 53));
		expect(c.headers().map((el) => el.dataset.weekIndex)).toEqual(Array.from({ length: 13 }, (_, index) => String(40 + index)));
		for (let index = 0; index < c.files.length; index++) {
			const cells = byClass(c.row(index), 'q-fold-cell');
			expect(cells).toHaveLength(3);
			for (const cell of cells) {
				expect(cell.tagName).toBe('td');
				expect(cell.children).toHaveLength(0);
				expect(textOf(cell)).toBe('');
				expect(byClass(cell, 'bar')).toHaveLength(0);
				expect(cell.dataset.path).toBeUndefined();
				expect(cell.dataset.week).toBeUndefined();
			}
			expect(byClass(c.row(index), 'week-cell').map((el) => el.dataset.weekIndex)).toEqual(c.headers().map((el) => el.dataset.weekIndex));
			const today = required(byClass(c.row(index), 'today-col')[0], '今天的週格');
			expect(today.dataset.weekIndex).toBe('46');
			expect(byClass(today, 'bar')[0]?.dataset.week).toBe('2026-W47');
		}
		expect(byClass(c.table(), 'today-week')).toEqual([c.heading(47)]);
		await click(required(byClass(c.row(), 'q-fold-cell')[0], '折起的季'));
		expect(c.popover().hidden).toBe(true);
	});

	it('Expanding and folding a quarter', async () => {
		const c = await setup();
		await click(required(byClass(c.row(), 'bar')[0], 'W47 色條'));
		expect(c.popover().hidden).toBe(false);
		await click(button(c.table(), 'Q2 ▸'));
		expect(c.popover().hidden).toBe(true);
		expect(c.quarters().map(textOf)).toEqual(['Q1 ▸', 'Q2 ▾', 'Q3 ▸', 'Q4 ▾']);
		expect(button(c.table(), 'Q2 ▾').attributes.get('aria-expanded')).toBe('true');
		expect(button(c.table(), 'Q2 ▾').attributes.get('title')).toBe('折起這一季');
		expect(c.headers().map(textOf)).toEqual([...weekLabels(15, 27), ...weekLabels(41, 53)]);
		expect(yearHeaderColumns(c.chart()).map((el) => el.classes.has('q-fold-gap') ? 'fold' : textOf(el)))
			.toEqual(['fold', ...weekLabels(15, 27), 'fold', ...weekLabels(41, 53)]);
		await click(button(c.table(), 'Q2 ▾'));
		expectDefaultQuarters(c);
		expect(c.headers().map(textOf)).toEqual(weekLabels(41, 53));
	});

	it('Keyboard focus stays on the quarter heading', async () => {
		const c = await setup();
		const before = button(c.table(), 'Q2 ▸') as Element;
		before.focus();
		expect(c.doc.activeElement).toBe(before);
		await click(before);
		const after = button(c.table(), 'Q2 ▾');
		expect(after).not.toBe(before);
		expect(c.doc.activeElement).toBe(after);
	});

	it('The fold state survives drawing again', async () => {
		const c = await setup([{ tasks: TASK }, { status: 'pending', tasks: TASK }]);
		await click(button(c.table(), 'Q1 ▸'));
		const expected = ['Q1 ▾', 'Q2 ▸', 'Q3 ▸', 'Q4 ▾'];
		expect(c.quarters().map(textOf)).toEqual(expected);
		const before = c.table();
		const file = required(c.files[0], '專案筆記');
		c.vault.setFileContent(file.path, c.vault.getFileContent(file.path).replace('準備讀書會', '更新讀書會內容'));
		c.vault.trigger('modify', file);
		await vi.advanceTimersByTimeAsync(400);
		expect(c.table()).not.toBe(before);
		expect(c.quarters().map(textOf)).toEqual(expected);
		const paused = required(find(c.root, (el) => el.attributes.get('id') === 'show-paused')[0], '#show-paused');
		paused.checked = true;
		paused.dispatchEvent(new Event('change'));
		await vi.advanceTimersByTimeAsync(0);
		expect(byClass(c.table(), 'name')).toHaveLength(2);
		expect(c.quarters().map(textOf)).toEqual(expected);
		await c.pressT();
		expect(c.saveLocalStorage).toHaveBeenCalledWith('dashboard.viewMode', 'timeline');
		expect(c.quarters().map(textOf)).toEqual(expected);
		await click(scaleOption(c.root, '月視圖'));
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		await click(scaleOption(c.root, '年視圖'));
		expect(c.quarters().map(textOf)).toEqual(expected);
		// 折疊狀態不存進偏好；第一次打開時說明面板會記下自己的狀態，不在這裡檢查。
		expect(c.saveLocalStorage.mock.calls.some(([key]) => /fold|quarter/i.test(String(key)))).toBe(false);
	});

	it('Another year starts expanded', async () => {
		const c = await setup();
		await click(navigation(c.root, '下一年'));
		expect(c.title()).toBe('2027 年');
		expect(c.quarters().map(textOf)).toEqual(['Q1 ▾', 'Q2 ▾', 'Q3 ▾', 'Q4 ▾']);
		expect(c.headers().map(textOf)).toEqual(weekLabels(1, 52));
		expect(byClass(c.table(), 'q-fold-cell')).toHaveLength(0);
		expect(byClass(c.table(), 'today-week')).toHaveLength(0);
		expect(byClass(c.table(), 'today-col')).toHaveLength(0);
		await click(navigation(c.root, '上一年'));
		expect(c.title()).toBe('2026 年');
		expectDefaultQuarters(c);
	});

	it('Nothing is folded in the first quarter', async () => {
		vi.setSystemTime(new Date(2026, 0, 15, 12));
		const c = await setup();
		expect(c.quarters().map(textOf)).toEqual(['Q1 ▾', 'Q2 ▾', 'Q3 ▾', 'Q4 ▾']);
		expect(c.headers().map(textOf)).toEqual(weekLabels(1, 53));
		expect(byClass(c.table(), 'q-fold-cell')).toHaveLength(0);
	});

	it('A bar stops at a folded quarter', async () => {
		const c = await setup([{ start: '2026-08-03', end: '2026-11-30' }], 'timeline');
		const expectSpan = (start: number, span: string) => {
			const bars = byClass(c.row(), 'bar');
			expect(bars).toHaveLength(1);
			const bar = required(bars[0], 'Timeline 色條');
			expect(bar.classes.has('bar-span')).toBe(true);
			expect(bar.classes.has('bar-solid')).toBe(true);
			expect(bar.parentElement?.dataset.weekIndex).toBe(String(start - 1));
			expect(bar.dataset.week).toBe(`2026-W${start}`);
			expect(bar.cssProps['--pd-span']).toBe(span);
		};
		expectSpan(41, '9');
		await click(button(c.table(), 'Q3 ▸'));
		expectSpan(32, '18');
	});

	it('A bar stops at a folded quarter: clicking a dashed span opens the clicked week', async () => {
		const c = await setup([{ start: '2026-08-03', end: '2026-12-28' }]);
		const bars = byClass(c.row(), 'bar');
		expect(bars).toHaveLength(1);
		const bar = required(bars[0], '整條虛線');
		expect(bar.classes.has('bar-dashed')).toBe(true);
		expect(bar.classes.has('bar-span')).toBe(true);
		expect(bar.dataset.spanStart).toBe('40');
		expect(bar.parentElement?.dataset.weekIndex).toBe('40');
		expect(bar.cssProps['--pd-span']).toBe('12');
		// 用格子而非內縮的色條量位置，點在 W42 的中央。
		await click(bar, c.heading(41).getBoundingClientRect().left + 32 + 16);
		expect(c.popover().hidden).toBe(false);
		expect(textOf(c.popover())).toContain('W42');
		expect(textOf(c.popover())).toContain('10/12');
		// 重掃後仍能依整年索引找到跨週色條，並重開同一週浮窗。
		const file = required(c.files[0], '專案筆記');
		c.vault.trigger('modify', file);
		await vi.advanceTimersByTimeAsync(400);
		expect(c.popover().hidden).toBe(false);
		expect(textOf(c.popover())).toContain('W42');
	});
});

describe('year this-week navigation', () => {
	it('本週 is hidden while this week is in view', async () => {
		const c = await setup();
		expect(c.current().attributes.get('title')).toBe('捲到本週');
		expectThisWeekVisible(c);
		expect(find(c.root, (el) => el.textContent === '今年')).toHaveLength(0);
	});

	it('Scrolling back to this week', async () => {
		const c = await setup();
		for (const quarter of [1, 2, 3]) await click(button(c.table(), `Q${quarter} ▸`));
		c.chart().scrollLeft = 0;
		c.chart().dispatchEvent(new Event('scroll'));
		await vi.advanceTimersByTimeAsync(0);
		expect(c.heading(47).getBoundingClientRect().left).toBe(1752);
		expect(hidden(c.current())).toBe(false);
		expect(c.current().attributes.get('title')).toBe('捲到本週');
		await click(c.current());
		// 欄中心 1768、可見範圍中心 690，理想 1078 受最大捲距 876 限制。
		const expected = Math.round(Math.max(0, Math.min(280 + 46 * 32 + 16 - (280 + 1100) / 2, c.chart().scrollWidth - c.chart().clientWidth)));
		expect(expected).toBe(876);
		expect(c.chart().scrollLeft).toBe(expected);
		expectThisWeekVisible(c);
	});

	it('Centering a week in the middle of the year', async () => {
		vi.setSystemTime(new Date(2026, 6, 15, 12));
		const c = await setup();
		expect(c.quarters().map(textOf)).toEqual(['Q1 ▸', 'Q2 ▸', 'Q3 ▾', 'Q4 ▾']);
		for (const quarter of [1, 2]) await click(button(c.table(), `Q${quarter} ▸`));
		c.chart().scrollLeft = 0;
		c.chart().dispatchEvent(new Event('scroll'));
		await vi.advanceTimersByTimeAsync(0);
		expect(hidden(c.current())).toBe(false);
		await click(c.current());
		// W29 欄中心 280 + 28×32 + 16 = 1192，可見範圍中心 690，捲距 502 在範圍內。
		expect(c.chart().scrollLeft).toBe(502);
		const rect = c.heading(29).getBoundingClientRect();
		expect(Math.abs((rect.left + rect.right) / 2 - (280 + 1100) / 2)).toBeLessThanOrEqual(1);
		expect(hidden(c.current())).toBe(true);
	});

	it('Narrowing the pane shows 本週', async () => {
		const c = await setup();
		expect(hidden(c.current())).toBe(true);
		// 拖窄旁邊的分割：視窗沒有 resize，只有窗格變窄；W47 右緣 280 + 3×40 + 7×32 = 624 超出 600。
		c.chart().clientWidth = 600;
		(c.view as unknown as { onResize(): void }).onResize();
		expect(c.heading(47).getBoundingClientRect().right).toBeGreaterThan(600);
		expect(hidden(c.current())).toBe(false);
	});

	it('本週 from another year', async () => {
		const c = await setup();
		await click(navigation(c.root, '下一年'));
		expect(c.title()).toBe('2027 年');
		expect(hidden(c.current())).toBe(false);
		await click(c.current());
		expect(c.title()).toBe('2026 年');
		expectDefaultQuarters(c);
		expectThisWeekVisible(c);
	});

	it('本週 when this week\'s quarter is folded', async () => {
		const c = await setup();
		await click(button(c.table(), 'Q4 ▾'));
		expect(button(c.table(), 'Q4 ▸').attributes.get('aria-expanded')).toBe('false');
		expect(c.headers()).toHaveLength(0);
		expect(hidden(c.current())).toBe(false);
		await click(c.current());
		expectDefaultQuarters(c);
		expectThisWeekVisible(c);
	});

	it('Opening the month view shows the current month: 本月 is unchanged', async () => {
		const c = await setup();
		await click(scaleOption(c.root, '月視圖'));
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expect(hidden(button(c.root, '本月'))).toBe(true);
		expect(byClass(c.chart(), 'quarter-toggle')).toHaveLength(0);
		expect(byClass(c.chart(), 'q-fold-cell')).toHaveLength(0);
		await click(navigation(c.root, '下一個月'));
		expect(c.title()).toBe('2026 年 12 月（W50–W53）');
		expect(hidden(button(c.root, '本月'))).toBe(false);
		await click(button(c.root, '本月'));
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expect(hidden(button(c.root, '本月'))).toBe(true);
	});
});
