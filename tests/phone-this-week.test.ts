import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { CalendarStore } from '../src/calendar-store';
import type { ProjectRecord } from '../src/core/scan';
import { defaultSettings } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { VaultSource } from '../src/vault-source';
import { ProjectDashboardView } from '../src/view';
import { placePopover } from '../src/core/popover-position';
import { Platform, SettingsElement, TFile, TFolder, Vault } from './stubs/obsidian';

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
			const value = name.startsWith('data-') ? el.dataset[name.slice(5)] : el.attributes.get(name);
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
	clientWidth = 390;
	offsetWidth = 300;
	offsetHeight = 200;
	rect = { left: 0, top: 0, right: 390, bottom: 844 };
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
	getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
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
	getBoundingClientRect() {
		if (this.attributes.get('id') === 'chart') return { left: 0, right: 390, top: 0, bottom: 844 };
		if (this.tagName === 'th' && this.classes.has('proj-col')) return { left: 0, right: 96, top: 0, bottom: 44 };
		if (this.tagName === 'th' && this.classes.has('month-week')) {
			const chart = required(this.closest('#chart'), '週欄所在的 #chart');
			const headers = required(this.parentElement, '表頭列').children.filter((el) => el.tagName === 'th' && el.classes.has('month-week'));
			const left = 96 + 120 * headers.indexOf(this) - chart.scrollLeft;
			return { left, right: left + 120, top: 0, bottom: 44 };
		}
		return this.rect;
	}
	focus(): void { this.ownerDocument.activeElement = this; }
	onWindowMigrated(): () => void { return () => {}; }
}

class TestDocument extends EventTarget {
	readonly body = new Element(this);
	readonly defaultView = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844 });
	activeElement: SettingsElement | null = null;
}

interface Note {
	name?: string;
	status?: ProjectRecord['status'];
	tasks: string;
}
const TASK = '- [ ] 準備讀書會 📅 2026-11-20';
const opened: Array<() => Promise<void>> = [];

async function setup(notes: Note[] = [{ tasks: TASK }], options: { phone?: boolean; tablet?: boolean } = {}) {
	Platform.isPhone = options.phone ?? true;
	Platform.isTablet = options.tablet ?? false;
	const settings = { ...defaultSettings(), projectFolder: 'Projects', saturdayCountsAsNextWeek: false, scheduleWeekday: 5 };
	const vault = new Vault();
	const folder = new TFolder('Projects');
	vault.setAbstractFile(folder);
	const files = notes.map((note, index) => {
		const prefix = { active: '🚧', pending: '⏳', done: '✅', cancelled: '❌' }[note.status ?? 'active'];
		const file = new TFile(`Projects/${prefix} ${note.name ?? `範例專案 ${String.fromCharCode(65 + index)}`}.md`);
		vault.setAbstractFile(file);
		folder.children.push(file);
		vault.setFileContent(file.path, `---\n開始日期: 2026-01-01\n預計結束日期: 2026-12-31\n---\n${note.tasks}`);
		return file;
	});
	const source = new VaultSource(vault, () => ({}), () => settings);
	source.registerVaultEvents({ registerEvent: vi.fn() });
	const process = vault.process.bind(vault);
	// 真實寫入會發 modify；沿用防抖重掃，才驗得到打勾後重繪是否保留位置。
	vi.spyOn(vault, 'process').mockImplementation(async (file, fn) => {
		const result = await process(file, fn);
		vault.trigger('modify', file);
		return result;
	});
	const calendars = new CalendarStore({
		request: async () => ({ status: 200, text: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' }),
		getSecret: () => null, now: () => new Date(), calendars: () => settings.calendars, enabled: () => !Platform.isPhone,
	});
	const doc = new TestDocument();
	const root = doc.body.createDiv();
	const disposers: Array<() => void> = [];
	const leaf = { openFile: vi.fn(async () => {}) };
	const plugin = { store: { data: { settings, categoryOverrides: {} }, subscribe: () => vi.fn() }, calendars };
	const view = new ProjectDashboardView(leaf as unknown as WorkspaceLeaf, source, plugin as unknown as ProjectDashboardPlugin);
	Object.assign(view, {
		app: {
			vault, scope: {}, loadLocalStorage: (key: string) => key === 'dashboard.scale' ? 'month' : null,
			saveLocalStorage: vi.fn(), workspace: { createLeafBySplit: vi.fn(), iterateAllLeaves: vi.fn() },
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
	const chart = () => required(find(root, (el) => el.attributes.get('id') === 'chart')[0], '#chart') as Element;
	const table = () => required(find(chart(), (el) => el.tagName === 'table' && el.classes.has('month-grid'))[0], 'table.month-grid');
	const row = (index = 0) => required(find(table(), (el) => el.tagName === 'tr'
		&& byClass(el, 'name').some((name) => name.dataset.path === files[index]!.path))[0], `專案列 ${index}`);
	const cell = (week = 47, index = 0) => required(byClass(row(index), 'month-cell').find((el) => el.dataset.week === `2026-W${week}`), `W${week} 格`);
	const heading = (week: number) => required(find(table(), (el) => el.tagName === 'th' && el.classes.has('month-week')
		&& byClass(el, 'mw-week').some((label) => label.textContent === `W${week}`))[0], `W${week} 欄頭`);
	const popover = () => required(byClass(doc.body, 'pd-week-popover')[0], '.pd-week-popover');
	const title = () => required(byClass(root, 'month-title')[0], '月份標題').textContent;
	const line = (index = 0) => vault.getFileContent(files[index]!.path).split('\n').slice(4).join('\n');
	return { root, chart, table, row, cell, heading, popover, title, line, vault, files };
}

function button(root: SettingsElement, text: string): SettingsElement {
	return required(find(root, (el) => el.tagName === 'button' && el.textContent === text)[0], `按鈕 ${text}`);
}
function navigation(root: SettingsElement, title: string): SettingsElement {
	return required(byClass(root, 'month-nav-btn').find((el) => el.attributes.get('title') === title), title);
}
async function click(target: SettingsElement): Promise<void> {
	const el = target as Element;
	const path: EventTarget[] = [];
	for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) path.push(ancestor);
	path.push(el.ownerDocument);
	// 重繪可能換掉被點的元素，因此保留原始路徑，讓 document 的委派事件能照常處理。
	for (const receiver of path) {
		const event = new Event('click', { cancelable: true });
		Object.defineProperties(event, { target: { value: el }, composedPath: { value: () => path } });
		receiver.dispatchEvent(event);
	}
	await vi.advanceTimersByTimeAsync(0);
}
async function tick(checkbox: SettingsElement): Promise<void> {
	expect(checkbox.disabled).toBe(false);
	checkbox.checked = !checkbox.checked;
	checkbox.dispatchEvent(new Event('change'));
	await vi.advanceTimersByTimeAsync(400);
}
function expectScroll(c: Awaited<ReturnType<typeof setup>>, left: number, top: number): void {
	expect.soft(c.chart().scrollLeft).toBe(left);
	expect.soft(c.chart().scrollTop).toBe(top);
}
function expectThisWeek(c: Awaited<ReturnType<typeof setup>>): void {
	const heading = c.heading(47);
	expect.soft(heading.classes.has('mw-today')).toBe(true);
	const week = required(byClass(heading, 'mw-week')[0], 'W47 文字');
	expect.soft(week.tagName).toBe('div');
	expect.soft(week.textContent).toBe('W47');
	expect.soft(byClass(week, 'mw-today-tag').map((el) => ({ tag: el.tagName, text: el.textContent }))).toEqual([{ tag: 'span', text: '本週' }]);
	expect.soft(byClass(c.table(), 'mw-today')).toHaveLength(1);
	expect.soft(byClass(c.table(), 'mw-today-tag')).toHaveLength(1);
}
function expectNoThisWeek(c: Awaited<ReturnType<typeof setup>>): void {
	expect.soft(byClass(c.table(), 'mw-today')).toHaveLength(0);
	expect.soft(byClass(c.table(), 'mw-today-tag')).toHaveLength(0);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 10, 20, 12));
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

describe('phone this-week position and project names', () => {
	it('The phone opens on this week', async () => {
		const c = await setup();
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expectScroll(c, 240, 0);
		expectThisWeek(c);
		const projectHeader = required(find(c.table(), (el) => el.tagName === 'th' && el.classes.has('proj-col'))[0], '專案欄頭') as Element;
		expect.soft((c.heading(47) as Element).getBoundingClientRect().left).toBe(projectHeader.getBoundingClientRect().right);
		expect.soft((c.heading(48) as Element).getBoundingClientRect().right).toBeLessThanOrEqual(c.chart().getBoundingClientRect().right);
	});

	it('Changing the month on a phone: next month and current month', async () => {
		const c = await setup();
		c.chart().scrollLeft = 100;
		c.chart().scrollTop = 500;
		const next = navigation(c.root, '下一個月');
		expect(next.textContent).toBe('▶');
		await click(next);
		expect(c.title()).toBe('2026 年 12 月（W50–W53）');
		expectScroll(c, 0, 0);
		expectNoThisWeek(c);
		c.chart().scrollTop = 500;
		await click(button(c.root, '本月'));
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expectScroll(c, 240, 0);
		expectThisWeek(c);
	});

	it('Changing the month on a phone: previous month and next month', async () => {
		const c = await setup();
		c.chart().scrollLeft = 100;
		c.chart().scrollTop = 500;
		const previous = navigation(c.root, '上一個月');
		expect(previous.textContent).toBe('◀');
		await click(previous);
		// weeksOfMonth(2026, 10) 從週一在 10 月的 W41 起算，W40 屬於 9 月。
		expect(c.title()).toBe('2026 年 10 月（W41–W44）');
		expectScroll(c, 0, 0);
		expectNoThisWeek(c);
		// 以非零位置回到本月，才能抓到計算差距時漏加既有 scrollLeft 的錯誤。
		c.chart().scrollLeft = 123;
		c.chart().scrollTop = 500;
		await click(navigation(c.root, '下一個月'));
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expectScroll(c, 240, 0);
		expectThisWeek(c);
	});

	it('Drawing again keeps the scroll position: ticking a task in a popover', async () => {
		const c = await setup();
		c.chart().scrollLeft = 0;
		c.chart().scrollTop = 300;
		const before = c.table();
		await click(c.cell());
		expect(c.popover().hidden).toBe(false);
		const task = required(byClass(c.popover(), 'wp-row').find((row) => byClass(row, 'wp-text').some((el) => el.textContent === '準備讀書會')), '浮窗任務 準備讀書會');
		await tick(required(byClass(task, 'wp-check')[0], '任務核取方塊'));
		expect(c.line()).toBe('- [x] 準備讀書會 📅 2026-11-20 ✅ 2026-11-20');
		expect(c.table()).not.toBe(before);
		expect(textOf(c.cell())).toBe('✓ 準備讀書會');
		expectScroll(c, 0, 300);
	});

	it('Drawing again keeps the scroll position: an external note change', async () => {
		const c = await setup();
		c.chart().scrollLeft = 0;
		c.chart().scrollTop = 300;
		const before = c.table();
		const file = required(c.files[0], '專案筆記');
		c.vault.setFileContent(file.path, c.vault.getFileContent(file.path).replace('準備讀書會', '更新讀書會內容'));
		c.vault.trigger('modify', file);
		await vi.advanceTimersByTimeAsync(400);
		expect(c.table()).not.toBe(before);
		expect(textOf(c.cell())).toBe('更新讀書會內容');
		expectScroll(c, 0, 300);
	});

	it('Drawing again keeps the scroll position: showing a paused project', async () => {
		const c = await setup([{ tasks: TASK }, { status: 'pending', tasks: TASK }]);
		c.chart().scrollLeft = 0;
		c.chart().scrollTop = 300;
		const before = c.table();
		const checkbox = required(find(c.root, (el) => el.attributes.get('id') === 'show-paused')[0], '#show-paused');
		const label = required(checkbox.parentElement, '顯示暫停標籤');
		expect(textOf(label)).toBe('顯示暫停（1）');
		expect(label.hidden).toBe(false);
		expect(checkbox.checked).toBe(false);
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['範例專案 A']);
		await tick(checkbox);
		expect(checkbox.checked).toBe(true);
		expect(c.table()).not.toBe(before);
		expect(byClass(c.table(), 'name').map(textOf).sort()).toEqual(['範例專案 A', '範例專案 B']);
		expectScroll(c, 0, 300);
	});

	it('Turning the phone after it opened on this week keeps the popover', async () => {
		const c = await setup();
		expectScroll(c, 240, 0);
		const cell = c.cell() as Element;
		cell.rect = { left: 96, top: 200, right: 216, bottom: 244 };
		await click(cell);
		expect(c.popover().hidden).toBe(false);
		const win = cell.ownerDocument.defaultView;
		const root = c.root;
		const scroll = (): void => {
			// 捲動監聽器掛在視窗上（捕獲階段），用 target 判斷捲動的是不是格子所在的表格。
			const event = new Event('scroll');
			Object.defineProperty(event, 'target', { value: c.chart() });
			win.dispatchEvent(event);
		};
		// 轉成橫放：視窗與儀表板變寬，表格不再需要左右捲。
		win.innerWidth = 800;
		root.rect = { left: 0, top: 0, right: 800, bottom: 844 };
		cell.rect = { left: 336, top: 200, right: 456, bottom: 244 };
		win.dispatchEvent(new Event('resize'));
		// 接著瀏覽器自己把 scrollLeft 調回 0，格子往右移 240，並發出 scroll 事件。
		c.chart().scrollLeft = 0;
		cell.rect = { left: 576, top: 200, right: 696, bottom: 244 };
		scroll();
		await vi.advanceTimersByTimeAsync(0);
		expect(c.popover().hidden).toBe(false);
		const expected = placePopover({
			anchor: cell.rect,
			size: { width: (c.popover() as Element).offsetWidth, height: (c.popover() as Element).offsetHeight },
			pane: root.rect,
			viewport: { width: 800, height: 844 },
			margin: 8,
		});
		expect(Number.parseFloat(required(c.popover().cssProps['--pd-popover-left'], '浮窗左緣'))).toBe(expected.left);
		expect(Number.parseFloat(required(c.popover().cssProps['--pd-popover-top'], '浮窗上緣'))).toBe(expected.top);
		// 轉向結束一段時間後，使用者自己滑表格，浮窗照舊關閉。
		await vi.advanceTimersByTimeAsync(600);
		scroll();
		expect(c.popover().hidden).toBe(true);
	});

	it('A project name drops its date code on a phone', async () => {
		const c = await setup([{ name: 'P-20260302 範例企業內訓規劃', tasks: TASK }]);
		const name = required(byClass(c.row(), 'name')[0], '專案名稱');
		expect.soft(name.textContent).toBe('範例企業內訓規劃');
		expect(name.dataset.path).toBe('Projects/🚧 P-20260302 範例企業內訓規劃.md');
		await click(c.cell());
		expect(c.popover().hidden).toBe(false);
		expect(byClass(c.popover(), 'wp-project').map(textOf)).toEqual(['P-20260302 範例企業內訓規劃']);
	});

	it('A name without a date code is shown unchanged', async () => {
		const c = await setup([{ name: 'P-範例專案', tasks: TASK }, { name: '範例專案 B', tasks: TASK }]);
		expect(byClass(c.table(), 'name').map(textOf).sort()).toEqual(['P-範例專案', '範例專案 B']);
	});

	it.each([
		{ label: 'computer', tablet: false },
		{ label: 'tablet', tablet: true },
	])('A project name drops its date code on a phone: $label stays unchanged', async ({ tablet }) => {
		const c = await setup([{ name: 'P-20260302 範例企業內訓規劃', tasks: TASK }], { phone: false, tablet });
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['P-20260302 範例企業內訓規劃']);
		expectNoThisWeek(c);
		expectScroll(c, 0, 0);
		c.chart().scrollLeft = 123;
		await click(navigation(c.root, '下一個月'));
		expect(c.title()).toBe('2026 年 12 月（W50–W53）');
		expectScroll(c, 123, 0);
		expectNoThisWeek(c);
		await click(button(c.root, '本月'));
		expect(c.title()).toBe('2026 年 11 月（W45–W49）');
		expectScroll(c, 123, 0);
		expectNoThisWeek(c);
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['P-20260302 範例企業內訓規劃']);
	});
});
