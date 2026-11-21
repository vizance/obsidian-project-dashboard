import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl, type WorkspaceLeaf } from 'obsidian';
import { CalendarStore } from '../src/calendar-store';
import type { ProjectRecord } from '../src/core/scan';
import { defaultSettings, type DashboardSettings } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { VaultSource } from '../src/vault-source';
import { ProjectDashboardView } from '../src/view';
import { MarkdownView, Notice, Platform, Scope, SettingsElement, TFile, TFolder, Vault } from './stubs/obsidian';

vi.mock('obsidian', async (importOriginal) => ({
	...await importOriginal<typeof import('./stubs/obsidian')>(),
	requestUrl: vi.fn(() => Promise.resolve({ status: 200, text: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' })),
}));

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
	getBoundingClientRect() { return this.rect; }
	focus(): void { this.ownerDocument.activeElement = this; }
	onWindowMigrated(): () => void { return () => {}; }
}

class TestDocument extends EventTarget {
	readonly body = new Element(this);
	readonly defaultView = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844 });
	activeElement: SettingsElement | null = null;
}

interface ViewHarness {
	scope: Scope;
}
interface Note {
	name?: string;
	status?: ProjectRecord['status'];
	start?: string;
	end?: string;
	tasks: string;
}
const TASK = '- [ ] 準備讀書會 📅 2026-11-20';
const opened: Array<() => Promise<void>> = [];

async function setup(notes: Note[] = [{ tasks: TASK }], options: {
	phone?: boolean; tablet?: boolean; width?: number;
	prefs?: Record<string, string>; settings?: Partial<DashboardSettings>;
} = {}) {
	Platform.isPhone = options.phone ?? true;
	Platform.isTablet = options.tablet ?? false;
	const settings = { ...defaultSettings(), projectFolder: 'Projects', saturdayCountsAsNextWeek: false, scheduleWeekday: 5, ...options.settings };
	const vault = new Vault();
	const folder = new TFolder('Projects');
	vault.setAbstractFile(folder);
	const files = notes.map((note, index) => {
		const prefix = { active: '🚧', pending: '⏳', done: '✅', cancelled: '❌' }[note.status ?? 'active'];
		const file = new TFile(`Projects/${prefix} ${note.name ?? `範例專案 ${String.fromCharCode(65 + index)}`}.md`);
		vault.setAbstractFile(file);
		folder.children.push(file);
		vault.setFileContent(file.path, `---\n開始日期: ${note.start ?? '2026-01-01'}\n預計結束日期: ${note.end ?? '2026-12-31'}\n---\n${note.tasks}`);
		return file;
	});
	const source = new VaultSource(vault, () => ({}), () => settings);
	source.registerVaultEvents({ registerEvent: vi.fn() });
	const process = vault.process.bind(vault);
	// 真實 vault.process 會發 modify；讓成功寫入走真正 VaultSource 的防抖重掃。
	vi.spyOn(vault, 'process').mockImplementation(async (file, fn) => {
		const result = await process(file, fn);
		vault.trigger('modify', file);
		return result;
	});
	const getSecret = vi.fn(() => 'https://calendar.example.com/feed.ics');
	const calendars = new CalendarStore({
		request: async (url) => requestUrl({ url, method: 'GET', throw: false }),
		getSecret, now: () => new Date(), calendars: () => settings.calendars, enabled: () => !Platform.isPhone,
	});
	let editorText: string | null = null;
	const editor = {
		getValue: () => editorText ?? vault.getFileContent(files[0]!.path),
		setSelection: vi.fn(), scrollIntoView: vi.fn(), focus: vi.fn(),
	};
	const leaf = { view: null as MarkdownView | null, openFile: vi.fn(() => {
		leaf.view = new MarkdownView(editor);
		return Promise.resolve();
	}) };
	const split = { view: null as MarkdownView | null, openFile: vi.fn(() => {
		split.view = new MarkdownView(editor);
		return Promise.resolve();
	}) };
	const createLeafBySplit = vi.fn(() => split);
	const saveLocalStorage = vi.fn();
	const loadLocalStorage = vi.fn((key: string) => options.prefs?.[key] ?? null);
	const doc = new TestDocument();
	doc.defaultView.innerWidth = options.width ?? 390;
	const root = doc.body.createDiv();
	root.clientWidth = doc.defaultView.innerWidth;
	root.rect.right = root.clientWidth;
	const registrations: Array<{ target: EventTarget; name: string }> = [];
	const disposers: Array<() => void> = [];
	const plugin = { store: { data: { settings, categoryOverrides: {} }, subscribe: () => vi.fn() }, calendars };
	const view = new ProjectDashboardView(leaf as unknown as WorkspaceLeaf, source, plugin as unknown as ProjectDashboardPlugin);
	Object.assign(view, {
		app: { vault, scope: {}, loadLocalStorage, saveLocalStorage,
			workspace: { createLeafBySplit, iterateAllLeaves: (cb: (entry: unknown) => void) => cb(split) } },
		leaf, contentEl: root, containerEl: root,
		registerDomEvent: (target: EventTarget, name: string, callback: EventListener) => {
			registrations.push({ target, name });
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
	const harness = view as unknown as ViewHarness;
	const chart = () => required(find(root, (el) => el.attributes.get('id') === 'chart')[0], '#chart');
	const table = () => required(find(chart(), (el) => el.tagName === 'table' && el.classes.has('month-grid'))[0], 'table.month-grid 尚未呈現');
	const row = (index = 0) => required(find(table(), (el) => el.tagName === 'tr'
		&& byClass(el, 'name').some((name) => name.dataset.path === files[index]!.path))[0], `專案列 ${index}`);
	const cell = (week = 47, index = 0) => required(byClass(row(index), 'month-cell').find((el) => el.dataset.week === `2026-W${week}`), `W${week} 格`);
	const unscheduled = (index = 0) => required(find(row(index), (el) => el.tagName === 'td' && el.classes.has('month-unscheduled'))[0], '還沒排格');
	const popover = () => required(byClass(doc.body, 'pd-week-popover')[0], '.pd-week-popover 尚未建立');
	const toast = () => required(find(root, (el) => el.attributes.get('id') === 'toast')[0], '#toast');
	const line = (index = 0) => vault.getFileContent(files[index]!.path).split('\n').slice(4).join('\n');
	return { view, harness, root, doc, chart, table, row, cell, unscheduled, popover, toast, line,
		vault, files, source, leaf, split, editor, createLeafBySplit, saveLocalStorage, loadLocalStorage,
		registrations, getSecret, setEditorText: (text: string) => { editorText = text; } };
}

function button(root: SettingsElement, text: string): SettingsElement {
	return required(find(root, (el) => el.tagName === 'button' && el.textContent === text)[0], `按鈕 ${text}`);
}
function hidden(el: SettingsElement): boolean { return el.hidden || (el.parentElement ? hidden(el.parentElement) : false); }

async function click(target: SettingsElement): Promise<void> {
	const el = target as Element;
	const path: EventTarget[] = [];
	for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) path.push(ancestor);
	path.push(el.ownerDocument);
	// 保留點擊時的 path，模擬浮窗按鈕在 handler 內重繪後的原生 composedPath。
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
function taskRow(popover: SettingsElement, text = '準備讀書會'): SettingsElement {
	return required(byClass(popover, 'wp-row').find((row) => byClass(row, 'wp-text').some((el) => el.textContent === text)), `浮窗任務 ${text}`);
}
async function openTask(c: Awaited<ReturnType<typeof setup>>): Promise<SettingsElement> {
	await click(c.cell());
	expect(c.popover().hidden).toBe(false);
	return taskRow(c.popover());
}
async function setupMonth(notes: Note[] | undefined, phone: boolean) {
	const c = await setup(notes, { phone });
	if (!phone) await click(button(c.root, '月'));
	return c;
}
function expectNoPhonePreferenceWrites(c: Awaited<ReturnType<typeof setup>>): void {
	expect(c.saveLocalStorage.mock.calls.filter(([key]) => ['dashboard.scale', 'dashboard.viewMode', 'dashboard.projColWidth'].includes(String(key)))).toEqual([]);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 10, 20, 12));
	Notice.messages = [];
	vi.mocked(requestUrl).mockClear();
	vi.stubGlobal('window', {
		setTimeout: (fn: () => void, ms: number) => Number(setTimeout(fn, ms)),
		clearTimeout: (id: number) => clearTimeout(id),
	});
});
afterEach(async () => {
	for (const close of opened.splice(0)) await close();
	Platform.isPhone = false;
	Platform.isTablet = false;
	Notice.messages = [];
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('phone month layout', () => {
	it('A phone gets the month view', async () => {
		const c = await setup();
		expect(c.table().tagName).toBe('table');
		expect(c.root.classes.has('pd-phone')).toBe(true);
		expect(find(c.root, (el) => el.tagName === 'header')).toEqual([]);
		for (const cls of ['legend', 'scale-switch', 'phone-week-heading', 'phone-week', 'phone-overdue']) expect(byClass(c.root, cls)).toEqual([]);
		for (const id of ['help-fab', 'help-panel', 'show-closed', 'edit-categories']) expect(find(c.root, (el) => el.attributes.get('id') === id)).toEqual([]);
	});
	it('A tablet keeps the year and month views', async () => {
		const c = await setup(undefined, { phone: false, tablet: true });
		for (const cls of ['scale-switch', 'legend']) expect(byClass(c.root, cls)).toHaveLength(1);
		expect(find(c.root, (el) => el.attributes.get('id') === 'help-fab')).toHaveLength(1);
		expect(byClass(c.root, 'gantt')).toHaveLength(1);
		await click(button(c.root, '月'));
		expect(c.table()).toBeDefined();
	});
	it('A narrow desktop pane keeps the desktop layout', async () => {
		const c = await setup(undefined, { phone: false, width: 380 });
		c.doc.defaultView.dispatchEvent(new Event('resize'));
		c.view.render();
		for (const cls of ['scale-switch', 'legend']) expect(byClass(c.root, cls)).toHaveLength(1);
		for (const id of ['help-fab', 'show-closed', 'edit-categories']) expect(find(c.root, (el) => el.attributes.get('id') === id)).toHaveLength(1);
		expect(c.root.classes.has('pd-phone')).toBe(false);
	});
	it('Shortcuts do nothing on a phone', async () => {
		const c = await setup();
		expect(c.harness.scope.bindings.filter(({ key }) => ['m', 'M', 't', 'T', '?', 'Escape'].includes(key))).toEqual([]);
		expectNoPhonePreferenceWrites(c);
		c.table();
		await click(button(c.root, '▶'));
		expectNoPhonePreferenceWrites(c);
		await click(button(c.root, '本月'));
		const row = await openTask(c);
		await tick(required(byClass(row, 'wp-check')[0], '任務核取方塊'));
		expect(c.line()).toBe('- [x] 準備讀書會 📅 2026-11-20 ✅ 2026-11-20');
		expectNoPhonePreferenceWrites(c);
	});
	it('The phone always opens on this month', async () => {
		const c = await setup(undefined, { prefs: { 'dashboard.scale': 'year', 'dashboard.projColWidth': '300' } });
		expect(required(byClass(c.root, 'month-title')[0], '月份標題').textContent).toBe('2026 年 11 月（W45–W49）');
		expect(hidden(button(c.root, '本月'))).toBe(true);
		expect(c.table().dataset.weeks).toBe('5');
		expect(c.root.cssProps['--proj-col-width']).toBe('96px');
		expect(c.loadLocalStorage).not.toHaveBeenCalledWith('dashboard.scale');
	});
	it('Changing the month on a phone', async () => {
		const c = await setup();
		const next = required(byClass(c.root, 'month-nav-btn').find((el) => el.attributes.get('title') === '下一個月'), '下一個月導覽鈕尚未建立');
		expect(next.textContent).toBe('▶');
		expect(next.attributes.get('title')).toBe('下一個月');
		await click(next);
		expect(required(byClass(c.root, 'month-title')[0], '月份標題').textContent).toBe('2026 年 12 月（W50–W53）');
		expect(c.table().dataset.weeks).toBe('4');
		expect(hidden(button(c.root, '本月'))).toBe(false);
		await click(button(c.root, '本月'));
		expect(required(byClass(c.root, 'month-title')[0], '月份標題').textContent).toBe('2026 年 11 月（W45–W49）');
		expect(c.table().dataset.weeks).toBe('5');
		expect(hidden(button(c.root, '本月'))).toBe(true);
	});
	it('The phone always opens on this month: paused projects appear only when checked', async () => {
		const c = await setup([{ tasks: TASK }, { status: 'pending', tasks: TASK }]);
		const label = required(find(c.root, (el) => el.tagName === 'label' && textOf(el) === '顯示暫停（1）')[0], '顯示暫停（1）');
		const checkbox = required(find(label, (el) => el.type === 'checkbox')[0], '暫停核取方塊');
		expect(hidden(label)).toBe(false);
		expect(checkbox.checked).toBe(false);
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['範例專案 A']);
		await tick(checkbox);
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['範例專案 A', '範例專案 B']);
		await c.view.onClose();
		await c.view.onOpen();
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['範例專案 A']);
	});
	it('A closed project never shows on a phone', async () => {
		const c = await setup([{ tasks: TASK }, { name: '範例專案 B', status: 'cancelled', tasks: TASK }, { status: 'done', tasks: TASK }]);
		expect(byClass(c.table(), 'name').map(textOf)).toEqual(['範例專案 A']);
		expect(find(c.root, (el) => el.attributes.get('id') === 'show-closed')).toEqual([]);
	});
	it('A phone gets the month view: project cells match the computer month view', async () => {
		const notes = [{ tasks: `${TASK}\n- [x] 整理資料 📅 2026-11-13 ✅ 2026-11-13\n- [ ] 寄出邀請` },
			{ tasks: '- [ ] 確認時間 📅 2026-11-27\n- [ ] 逾期任務 📅 2026-11-06' }];
		const phone = await setup(notes);
		const computer = await setup(notes, { phone: false });
		await click(button(computer.root, '月'));
		const cells = (c: typeof phone) => find(c.table(), (el) => el.tagName === 'tr' && byClass(el, 'name').length > 0)
			.flatMap((row) => byClass(row, 'month-cell').map((cell) => ({ text: textOf(cell), classes: [...cell.classes].sort() })));
		expect(byClass(phone.table(), 'name').map(textOf)).toEqual(byClass(computer.table(), 'name').map(textOf));
		expect(cells(phone)).toEqual(cells(computer));
		expect(cells(phone)).toHaveLength(10);
		expect(phone.files.map((_, index) => textOf(phone.unscheduled(index)))).toEqual(['1', '']);
	});
	it('A phone gets the month view: no project-column drag is registered', async () => {
		const c = await setup();
		c.table();
		expect(c.registrations.filter(({ name }) => ['mousedown', 'mousemove', 'pointerdown', 'pointermove', 'touchstart', 'touchmove'].includes(name))).toEqual([]);
	});
	it('No General row on a phone', async () => {
		const c = await setup(undefined, { settings: { calendars: [{ name: '工作', secretId: 'work-calendar', color: '#4a7fd4' }] } });
		expect(requestUrl).not.toHaveBeenCalled();
		expect(c.getSecret).not.toHaveBeenCalled();
		expect(byClass(c.table(), 'general-row')).toEqual([]);
	});
});

describe('phone month popovers and writes', () => {
	// 電腦對照會跑到手機尚未實作的後半段，避免缺少表格掩蓋 helper 的錯誤。
	const layouts = [{ phone: true, label: 'phone' }, { phone: false, label: 'computer baseline' }];
	it.each(layouts)('Ticking a task from a phone: $label', async ({ phone }) => {
		const c = await setupMonth(undefined, phone);
		const row = await openTask(c);
		await tick(required(byClass(row, 'wp-check')[0], '任務核取方塊'));
		expect(c.line()).toBe('- [x] 準備讀書會 📅 2026-11-20 ✅ 2026-11-20');
		expect(textOf(c.cell())).toBe('✓ 準備讀書會');
		expect(byClass(c.cell(), 'mc-done').map(textOf)).toEqual(['✓ 準備讀書會']);
		expect(c.popover().hidden).toBe(false);
		expect(byClass(c.popover(), 'wp-project').map(textOf)).toEqual(['範例專案 A']);
		expect(textOf(required(byClass(c.popover(), 'wp-week')[0], '浮窗週標題'))).toContain('W47');
		expect(required(byClass(taskRow(c.popover()), 'wp-check')[0], '重繪的核取方塊').checked).toBe(true);
	});
	it.each(layouts)('Moving a task one week later from a phone: $label', async ({ phone }) => {
		const c = await setupMonth(undefined, phone);
		await click(button(await openTask(c), '▶'));
		await vi.advanceTimersByTimeAsync(400);
		expect(c.line()).toBe('- [ ] 準備讀書會 📅 2026-11-27');
		expect(textOf(c.cell(48))).toBe('準備讀書會');
	});
	it.each(layouts)('Scheduling an undated task from a phone: $label', async ({ phone }) => {
		const c = await setupMonth([{ tasks: '- [ ] 寄出邀請' }], phone);
		expect(textOf(c.unscheduled())).toBe('1');
		await click(c.unscheduled());
		expect(c.popover().hidden).toBe(false);
		await click(button(taskRow(c.popover(), '寄出邀請'), 'W48'));
		await vi.advanceTimersByTimeAsync(400);
		expect(c.line()).toBe('- [ ] 寄出邀請 📅 2026-11-27');
		expect(textOf(c.cell(48))).toBe('寄出邀請');
	});
	it.each(layouts)('Ticking a task from a phone: adding a task in W47 ($label)', async ({ phone }) => {
		const c = await setupMonth(undefined, phone);
		await openTask(c);
		await click(button(c.popover(), '＋ 新增任務'));
		const input = required(byClass(c.popover(), 'wp-input')[0], '新增任務輸入框');
		input.value = '訂場地';
		const enter = new Event('keydown', { cancelable: true });
		Object.defineProperties(enter, { key: { value: 'Enter' }, isComposing: { value: false } });
		input.dispatchEvent(enter);
		await vi.advanceTimersByTimeAsync(400);
		expect(c.line()).toBe(`${TASK}\n- [ ] 訂場地 📅 2026-11-20`);
	});
	it.each(layouts)('A changed line is not overwritten from a phone: $label', async ({ phone }) => {
		const c = await setupMonth(undefined, phone);
		const row = await openTask(c);
		const changed = c.vault.getFileContent(c.files[0]!.path).replace('準備讀書會', '剛修改的任務');
		c.vault.setFileContent(c.files[0]!.path, changed);
		await click(button(row, '▶'));
		expect(c.vault.getFileContent(c.files[0]!.path)).toBe(changed);
		expect(c.toast().textContent).toBe('這一行在筆記裡剛被改過，畫面已更新，請再試一次');
		expect(c.toast().hidden).toBe(false);
		expect(textOf(c.cell())).toBe('剛修改的任務');
	});
	it.each(layouts)('Ticking a task from a phone: blank cells and headings do not open; outside closes ($label)', async ({ phone }) => {
		const c = await setupMonth([{ start: '2026-11-16', end: '2026-11-20', tasks: TASK }], phone);
		const blank = required(byClass(c.row(), 'month-cell').find((el) => el.dataset.path === undefined), '空白週格');
		const heading = required(find(c.table(), (el) => el.tagName === 'th')[0], '表頭');
		for (const target of [blank, heading, c.unscheduled()]) {
			await click(target);
			expect(c.popover().hidden).toBe(true);
		}
		await openTask(c);
		await click(c.root);
		expect(c.popover().hidden).toBe(true);
	});
	it.each([
		{ phone: true, tablet: false }, { phone: false, tablet: false }, { phone: false, tablet: true },
	])('A popover fits a phone screen: phone class (phone: $phone, tablet: $tablet)', async (options) => {
		const c = await setup(undefined, options);
		if (!options.phone) await click(button(c.root, '月'));
		await openTask(c);
		expect(c.popover().classes.has('pd-popover-phone')).toBe(options.phone);
	});
	it('A popover fits a phone screen', async () => {
		const c = await setup();
		const cell = c.cell() as Element;
		cell.rect = { left: 300, right: 390, top: 200, bottom: 244 };
		await click(cell);
		const left = Number.parseFloat(required(c.popover().cssProps['--pd-popover-left'], '浮窗左緣'));
		expect(left).toBeGreaterThanOrEqual(8);
		expect(left + (c.popover() as Element).offsetWidth).toBeLessThanOrEqual(382);
	});
});

describe('phone note navigation', () => {
	it('Opening a note and going back', async () => {
		const c = await setup();
		await click(required(byClass(c.row(), 'name')[0], '專案名稱'));
		expect(c.leaf.openFile).toHaveBeenCalledWith(c.files[0]);
		expect(c.createLeafBySplit).not.toHaveBeenCalled();
		// 替身沒有 Obsidian 返回堆疊，只驗證同一分頁重新打開儀表板的結果。
		await c.view.onClose();
		await c.view.onOpen();
		expect(c.table()).toBeDefined();
		expect(required(byClass(c.root, 'month-title')[0], '月份標題').textContent).toBe('2026 年 11 月（W45–W49）');
	});
	it('Opening a note and going back: popover project title', async () => {
		const c = await setup();
		await openTask(c);
		await click(required(byClass(c.popover(), 'wp-project')[0], '浮窗專案名稱'));
		expect(c.popover().hidden).toBe(true);
		expect(c.leaf.openFile).toHaveBeenCalledWith(c.files[0]);
		expect(c.createLeafBySplit).not.toHaveBeenCalled();
	});
	it('Jumping to a task line on a phone', async () => {
		const c = await setup();
		await click(button(await openTask(c), '↗'));
		expect(c.popover().hidden).toBe(true);
		expect(c.leaf.openFile).toHaveBeenCalledWith(c.files[0]);
		expect(c.createLeafBySplit).not.toHaveBeenCalled();
		expect(c.leaf.view).toBeInstanceOf(MarkdownView);
		expect(c.editor.setSelection).toHaveBeenCalledWith({ line: 4, ch: 0 }, { line: 4, ch: TASK.length });
	});
	it('Jumping to a task line on a phone: changed editor line uses Notice', async () => {
		const c = await setup();
		const row = await openTask(c);
		c.setEditorText('只有剛修改的內容');
		await click(button(row, '↗'));
		expect(c.popover().hidden).toBe(true);
		expect(c.leaf.openFile).toHaveBeenCalledWith(c.files[0]);
		expect(c.createLeafBySplit).not.toHaveBeenCalled();
		expect(c.editor.setSelection).not.toHaveBeenCalled();
		expect(Notice.messages).toContain('找不到那一行，可能剛被改過');
	});
	it('Opening a note and going back: missing note stays in dashboard', async () => {
		const c = await setup();
		const name = required(byClass(c.row(), 'name')[0], '專案名稱');
		const lookup = c.vault.getAbstractFileByPath.bind(c.vault);
		vi.spyOn(c.vault, 'getAbstractFileByPath').mockImplementation((path) => path === c.files[0]!.path ? null : lookup(path));
		await click(name);
		expect(c.leaf.openFile).not.toHaveBeenCalled();
		expect(c.split.openFile).not.toHaveBeenCalled();
		expect(c.createLeafBySplit).not.toHaveBeenCalled();
		expect(c.toast().textContent).toBe('找不到這則筆記');
		expect(c.toast().hidden).toBe(false);
	});
	it('Opening a note and going back: computer name and jump reuse a split', async () => {
		const c = await setup(undefined, { phone: false });
		await click(button(c.root, '月'));
		await click(required(byClass(c.row(), 'name')[0], '專案名稱'));
		expect(c.createLeafBySplit).toHaveBeenCalledOnce();
		await click(button(await openTask(c), '↗'));
		expect(c.createLeafBySplit).toHaveBeenCalledOnce();
		expect(c.split.openFile).toHaveBeenCalledTimes(2);
		expect(c.split.openFile).toHaveBeenLastCalledWith(c.files[0]);
		expect(c.leaf.openFile).not.toHaveBeenCalled();
		expect(c.editor.setSelection).toHaveBeenCalledWith({ line: 4, ch: 0 }, { line: 4, ch: TASK.length });
	});
});
