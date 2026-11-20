import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { defaultSettings, type DashboardSettings } from '../src/core/settings';
import { scanProjectNote, type ProjectRecord } from '../src/core/scan';
import type ProjectDashboardPlugin from '../src/main';
import { PhoneWeekList } from '../src/phone-week-list';
import type { VaultSource } from '../src/vault-source';
import { ProjectDashboardView } from '../src/view';
import { Platform, Scope, SettingsElement, TFile, TFolder, Vault } from './stubs/obsidian';

function find(el: SettingsElement, predicate: (el: SettingsElement) => boolean): SettingsElement[] {
	return [...(predicate(el) ? [el] : []), ...el.children.flatMap((child) => find(child, predicate))];
}
function byClass(el: SettingsElement, cls: string): SettingsElement[] {
	return find(el, (child) => child.classes.has(cls));
}
function textOf(el: SettingsElement): string {
	return el.textContent + el.children.map(textOf).join('');
}

// 只在這份測試補足畫面會用到的 DOM；不改共用替身既有查詢與事件的行為。
function element(doc: EventTarget): SettingsElement {
	const el = new SettingsElement();
	el.createEl = (tag, options = {}) => {
		const child = element(doc);
		child.tagName = tag;
		child.parentElement = el;
		for (const cls of options.cls?.split(' ') ?? []) child.addClass(cls);
		for (const [name, value] of Object.entries(options.attr ?? {})) child.setAttribute(name, String(value));
		child.textContent = options.text ?? '';
		el.children.push(child);
		return child;
	};
	Object.assign(el, {
		ownerDocument: doc, scrollTop: 0, scrollLeft: 0,
		getAttribute: (name: string) => el.attributes.get(name) ?? null,
		querySelectorAll: (selector: string) => el.children.flatMap((child) => find(child, (entry) => {
			const role = /^\[role="([^"]+)"\]$/.exec(selector)?.[1];
			return role !== undefined && entry.attributes.get('role') === role;
		})),
		remove: () => { if (el.parentElement) el.parentElement.children = el.parentElement.children.filter((child) => child !== el); },
		onWindowMigrated: () => () => {},
	});
	return el;
}

interface ViewHarness {
	projects: ProjectRecord[];
	contentEl: SettingsElement & { scrollTop: number };
	chartEl: SettingsElement & { scrollLeft: number };
	scope: Scope;
	layout: 'phone' | 'full';
	showClosed: boolean;
	openProjectNote(path: string): Promise<void>;
	handleExternalChange(): Promise<void>;
}
interface Note {
	name?: string;
	status?: ProjectRecord['status'];
	start?: string;
	end?: string;
	tasks: string;
}

async function setup(notes: Note[] = [{ tasks: '- [ ] 準備讀書會 📅 2026-11-20' }], options: {
	phone?: boolean; tablet?: boolean; today?: string; settings?: Partial<DashboardSettings>; missing?: boolean;
} = {}) {
	Platform.isPhone = options.phone ?? true;
	Platform.isTablet = options.tablet ?? false;
	if (options.today) vi.setSystemTime(new Date(`${options.today}T12:00:00+08:00`));
	const settings = { ...defaultSettings(), saturdayCountsAsNextWeek: false, ...options.settings };
	const vault = new Vault();
	const files = notes.map((note, index) => {
		const prefix = { active: '🚧', pending: '⏳', done: '✅', cancelled: '❌' }[note.status ?? 'active'];
		const name = note.name ?? `範例專案 ${String.fromCharCode(65 + index)}`;
		const file = new TFile(`Projects/${prefix} ${name}.md`);
		vault.setAbstractFile(file);
		vault.setFileContent(file.path, `---\n開始日期: ${note.start ?? '2026-01-01'}\n預計結束日期: ${note.end ?? '2026-12-31'}\n---\n${note.tasks}`);
		return file;
	});
	let noteChanged: (() => void) | undefined;
	let settingsChanged: ((reason: string) => void) | undefined;
	const scan = vi.fn(() => Promise.resolve(options.missing
		? { status: 'missing-folder' as const, folder: 'Projects' }
		: { status: 'ok' as const, projects: files.flatMap((file) => {
			if (!(vault.getAbstractFileByPath(file.path) instanceof TFile)) return [];
			const p = scanProjectNote({ filename: file.name, path: file.path, text: vault.getFileContent(file.path) }, {
				overrides: {}, settings, today: '2026-11-20',
			});
			return p ? [p] : [];
		}) }));
	const source = { scan, onChange: (callback: () => void) => { noteChanged = callback; return vi.fn(); } };
	const calendars = { subscribe: vi.fn(() => vi.fn()), refresh: vi.fn() };
	const plugin = { store: { data: { settings }, subscribe: (callback: (reason: string) => void) => {
		settingsChanged = callback;
		return vi.fn();
	} }, calendars };
	const leaf = { openFile: vi.fn(() => Promise.resolve()) };
	const split = { openFile: vi.fn(() => Promise.resolve()) };
	const createLeafBySplit = vi.fn(() => split);
	const saveLocalStorage = vi.fn();
	const doc = new EventTarget();
	Object.assign(doc, { body: element(doc), defaultView: new EventTarget() });
	const root = element(doc);
	const view = new ProjectDashboardView(leaf as unknown as WorkspaceLeaf, source as unknown as VaultSource, plugin as unknown as ProjectDashboardPlugin);
	Object.assign(view, {
		app: { vault, scope: {}, loadLocalStorage: () => null, saveLocalStorage,
			workspace: { createLeafBySplit, iterateAllLeaves: (cb: (entry: unknown) => void) => cb(split) } },
		leaf, contentEl: root, containerEl: root,
		registerDomEvent: (target: EventTarget, name: string, callback: EventListener) => target.addEventListener(name, callback),
		register: vi.fn(),
	});
	await view.onOpen();
	const fixture = view as unknown as ViewHarness;
	const weeks = () => byClass(root, 'phone-week');
	const rows = (container = root) => byClass(container, 'phone-task');
	const row = (text: string, container = root) => rows(container).find((entry) => byClass(entry, 'phone-task-text')[0]?.textContent === text)!;
	const heading = () => byClass(root, 'phone-overdue-heading')[0];
	const overdue = () => byClass(root, 'phone-overdue')[0]!;
	const toast = () => find(root, (el) => el.attributes.get('id') === 'toast')[0]!;
	const line = (index = 0) => vault.getFileContent(files[index]!.path).split('\n').slice(4).join('\n');
	return { view, fixture, root, vault, files, settings, calendars, scan, leaf, split, createLeafBySplit, saveLocalStorage,
		weeks, rows, row, heading, overdue, toast, line,
		noteChanged: () => noteChanged!(), settingsChanged: () => settingsChanged!('settings-saved'),
	};
}

async function press(el: SettingsElement): Promise<void> {
	expect(el).toBeDefined();
	el.dispatchEvent(new Event('click'));
	await vi.advanceTimersByTimeAsync(0);
}
async function tick(row: SettingsElement): Promise<void> {
	const checkbox = find(row, (el) => el.type === 'checkbox')[0]!;
	expect(checkbox.disabled).toBe(false);
	checkbox.checked = !checkbox.checked;
	checkbox.dispatchEvent(new Event('change'));
	await vi.advanceTimersByTimeAsync(0);
}
function button(row: SettingsElement, text: string): SettingsElement {
	return find(row, (el) => el.tagName === 'button' && el.textContent === text)[0]!;
}
function checked(row: SettingsElement): boolean {
	return find(row, (el) => el.type === 'checkbox')[0]!.checked;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-11-20T12:00:00+08:00'));
	vi.stubGlobal('window', { setTimeout: (fn: () => void, ms: number) => Number(setTimeout(fn, ms)), clearTimeout: (id: number) => clearTimeout(id) });
});
afterEach(() => {
	Platform.isPhone = false;
	Platform.isTablet = false;
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('phone layout and four weeks', () => {
	it('A phone gets the week list', async () => {
		const c = await setup();
		expect(c.root.classes.has('pd-phone')).toBe(true);
		expect(c.weeks()).toHaveLength(4);
		for (const cls of ['controls', 'scale-switch', 'legend', 'gantt', 'month-grid', 'warn']) expect(byClass(c.root, cls)).toEqual([]);
		expect(find(c.root, (el) => ['help-fab', 'help-panel', 'show-closed', 'edit-categories'].includes(el.attributes.get('id') ?? ''))).toEqual([]);
		expect(c.calendars.subscribe).not.toHaveBeenCalled();
		expect(c.calendars.refresh).not.toHaveBeenCalled();
		Platform.isPhone = false;
		await c.fixture.handleExternalChange();
		expect(c.weeks()).toHaveLength(4);
		await c.view.onClose();
		Platform.isPhone = true;
		await c.view.onOpen();
		expect(c.weeks()).toHaveLength(4);
	});

	it('A phone gets the week list: the platform is read once per opening', async () => {
		let reads = 0;
		const original = Object.getOwnPropertyDescriptor(Platform, 'isPhone')!;
		let phone = true;
		Object.defineProperty(Platform, 'isPhone', { configurable: true, get: () => { reads++; return phone; }, set: (value: boolean) => { phone = value; } });
		try {
			const c = await setup([]);
			expect(reads).toBe(1);
			Platform.isPhone = false;
			await c.fixture.handleExternalChange();
			expect(reads).toBe(1);
			expect(c.fixture.layout).toBe('phone');
			await c.view.onClose();
			await c.view.onOpen();
			expect(reads).toBe(2);
			expect(c.fixture.layout).toBe('full');
			expect(byClass(c.root, 'gantt')).toHaveLength(1);
		} finally {
			Object.defineProperty(Platform, 'isPhone', original);
		}
	});

	it('A tablet keeps the year and month views', async () => {
		const c = await setup([], { phone: false, tablet: true });
		expect(c.fixture.layout).toBe('full');
		expect(byClass(c.root, 'gantt')).toHaveLength(1);
		expect(byClass(c.root, 'legend')).toHaveLength(1);
		await press(button(c.root, '月'));
		expect(byClass(c.root, 'month-grid')).toHaveLength(1);
		expect(c.calendars.refresh).toHaveBeenCalledOnce();
	});

	it('A narrow desktop pane keeps the desktop layout', async () => {
		const c = await setup([], { phone: false });
		Object.assign(c.root, { clientWidth: 380 });
		c.view.render();
		expect(c.fixture.layout).toBe('full');
		expect(byClass(c.root, 'scale-switch')).toHaveLength(1);
		expect(byClass(c.root, 'gantt')).toHaveLength(1);
		expect(c.weeks()).toEqual([]);
	});

	it('Shortcuts do nothing on a phone', async () => {
		const c = await setup();
		for (const key of ['m', 'M', 't', 'T', '?', '/']) {
			for (const binding of c.fixture.scope.bindings.filter((entry) => entry.key === key)) binding.callback({ target: null } as KeyboardEvent);
		}
		expect(c.saveLocalStorage).not.toHaveBeenCalled();
		expect(c.weeks()).toHaveLength(4);
	});

	it('A phone gets the week list: missing folder and no shown projects keep desktop messages', async () => {
		const missing = await setup([], { missing: true });
		expect(textOf(missing.root)).toContain('找不到專案資料夾：Projects');
		const empty = await setup([]);
		expect(textOf(empty.root)).toContain('（沒有符合條件的專案）');
	});

	it('Four weeks from today', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06\n- [ ] 準備讀書會 📅 2026-11-20\n- [ ] 訂場地 📅 2026-12-11\n- [ ] 寄成果報告 📅 2026-12-18' }]);
		expect(byClass(c.root, 'phone-week-heading').map(textOf)).toEqual(['本週 W47 11/16–11/22', '下週 W48 11/23–11/29', 'W49 11/30–12/6', 'W50 12/7–12/13']);
		expect(c.fixture.chartEl.children.map((el) => [...el.classes][0])).toEqual(['phone-overdue', 'phone-week', 'phone-week', 'phone-week', 'phone-week']);
		expect(c.heading()!.textContent).toBe('▸ 之前還沒做（1）');
		expect(c.rows().map((el) => byClass(el, 'phone-task-text')[0]!.textContent)).toEqual(['準備讀書會', '訂場地']);
		expect(byClass(c.row('準備讀書會'), 'phone-date')[0]!.textContent).toBe('11/20');
		expect(byClass(c.row('訂場地'), 'phone-date')[0]!.textContent).toBe('12/11');
		expect(c.weeks().slice(1, 3).map(textOf)).toEqual(['下週 W48 11/23–11/29這週沒有任務', 'W49 11/30–12/6這週沒有任務']);
		await press(c.heading()!);
		expect(textOf(c.overdue())).toContain('寄出邀請');
		expect(textOf(c.root)).not.toContain('寄成果報告');
	});

	it('The four weeks cross into the next year', async () => {
		const c = await setup([{ tasks: '- [ ] 跨年任務 📅 2027-01-08' }], { today: '2026-12-30' });
		expect(byClass(c.root, 'phone-week-heading').map(textOf)).toEqual(['本週 W53 12/28–1/3', '下週 W1 1/4–1/10', 'W2 1/11–1/17', 'W3 1/18–1/24']);
	});

	it('The Saturday rule decides the week', async () => {
		const c = await setup([{ tasks: '- [ ] 整理照片 📅 2026-11-28' }], { settings: { saturdayCountsAsNextWeek: true } });
		expect(textOf(c.weeks()[2]!)).toContain('整理照片');
		expect(textOf(c.weeks()[1]!)).not.toContain('整理照片');
	});

	it('Projects follow the dashboard\'s row order', async () => {
		const c = await setup([{ name: '範例專案 A', start: '2026-02-01', tasks: '- [ ] 準備讀書會 📅 2026-11-20' },
			{ name: '範例專案 B', start: '2026-01-01', tasks: '- [ ] 整理清單 📅 2026-11-20' }]);
		expect(byClass(c.weeks()[0]!, 'phone-project-name').map(textOf)).toEqual(['範例專案 B', '範例專案 A']);
		const group = byClass(c.root, 'phone-project')[0]!;
		expect(group.cssProps['--pd-cat-color']).toBeDefined();
		expect(byClass(group, 'cat-dot')).toHaveLength(1);
	});

	it('Paused projects appear only when checked', async () => {
		const c = await setup([{ status: 'pending', tasks: '- [ ] 準備讀書會 📅 2026-11-20' }]);
		const control = byClass(c.root, 'phone-paused')[0]!;
		expect(textOf(control)).toBe('顯示暫停（1）');
		expect(checked(control)).toBe(false);
		expect(c.rows()).toEqual([]);
		await tick(control);
		expect(textOf(c.weeks()[0]!)).toContain('準備讀書會');
		expect(c.root.children[0]).toBe(control);
		await c.view.onClose();
		await c.view.onOpen();
		expect(checked(byClass(c.root, 'phone-paused')[0]!)).toBe(false);
		expect(c.rows()).toEqual([]);
	});

	it('Paused projects appear only when checked: closed and undated projects never enter either section', async () => {
		const c = await setup(['done', 'cancelled', 'active'].map((status) => ({ status: status as ProjectRecord['status'], start: status === 'active' ? '' : undefined,
			tasks: '- [ ] 之前的任務 📅 2026-11-06\n- [ ] 準備讀書會 📅 2026-11-20' })));
		c.fixture.showClosed = true;
		c.view.render();
		expect(c.rows()).toEqual([]);
		expect(c.heading()).toBeUndefined();
		expect(byClass(c.root, 'phone-paused')[0]!.hidden).toBe(true);
	});

	it('A done task stays in its week', async () => {
		const c = await setup([{ tasks: '- [x] 整理閱讀清單 📅 2026-11-19 ✅ 2026-11-19' }]);
		const row = c.row('整理閱讀清單', c.weeks()[0]);
		expect(checked(row)).toBe(true);
		expect(row.classes.has('phone-done')).toBe(true);
		expect(byClass(row, 'phone-date')[0]!.textContent).toBe('11/19');
		expect(byClass(row, 'phone-action')).toEqual([]);
	});
});

describe('phone task editing', () => {
	it('Ticking a task on a phone', async () => {
		const c = await setup();
		await tick(c.row('準備讀書會'));
		expect(c.line()).toBe('- [x] 準備讀書會 📅 2026-11-20 ✅ 2026-11-20');
		expect(checked(c.row('準備讀書會', c.weeks()[0]))).toBe(true);
		expect(c.row('準備讀書會').classes.has('phone-done')).toBe(true);
		await tick(c.row('準備讀書會'));
		expect(c.line()).toBe('- [ ] 準備讀書會 📅 2026-11-20');
		expect(c.row('準備讀書會').classes.has('phone-open')).toBe(true);
	});

	it('Moving a task one week later', async () => {
		const c = await setup();
		await press(button(c.row('準備讀書會'), '▶'));
		expect(c.line()).toBe('- [ ] 準備讀書會 📅 2026-11-27');
		expect(textOf(c.weeks()[1]!)).toContain('準備讀書會');
		expect(c.toast().hidden).toBe(true);
	});

	it('Moving a task past the fourth week', async () => {
		const c = await setup([{ tasks: '- [ ] 訂場地 📅 2026-12-11' }]);
		await press(button(c.row('訂場地'), '▶'));
		expect(c.line()).toBe('- [ ] 訂場地 📅 2026-12-18');
		expect(c.toast().textContent).toBe('已移到 12/18，超出這 4 週');
		expect(c.rows()).toEqual([]);
	});

	it('Moving a task before this week', async () => {
		const c = await setup([{ tasks: '- [ ] 準備讀書會 📅 2026-11-16' }]);
		await press(button(c.row('準備讀書會'), '◀'));
		expect(c.line()).toBe('- [ ] 準備讀書會 📅 2026-11-09');
		expect(c.toast().textContent).toBe('已移到 11/9，在「之前還沒做」裡');
		expect(c.heading()!.textContent).toBe('▸ 之前還沒做（1）');
	});

	it('A recurring task cannot be ticked on a phone', async () => {
		const c = await setup([{ tasks: '- [ ] 週報 🔁 every week 📅 2026-11-20' }]);
		const row = c.rows()[0]!;
		const check = byClass(row, 'phone-check')[0]!;
		expect(check.disabled).toBe(true);
		expect(check.attributes.get('title')).toBe('重複任務請在筆記裡勾選');
		expect(byClass(row, 'phone-action').map(textOf)).toEqual(['◀', '▶']);
		await press(button(row, '▶'));
		expect(c.line()).toBe('- [ ] 週報 🔁 every week 📅 2026-11-27');
	});

	it('A changed line is not overwritten', async () => {
		const c = await setup();
		const content = c.vault.getFileContent(c.files[0]!.path).replace('準備讀書會', '已經改過的內容');
		c.vault.setFileContent(c.files[0]!.path, content);
		await press(button(c.row('準備讀書會'), '▶'));
		expect(c.vault.getFileContent(c.files[0]!.path)).toBe(content);
		expect(c.toast().textContent).toBe('這一行在筆記裡剛被改過，畫面已更新，請再試一次');
		expect(c.scan).toHaveBeenCalledTimes(2);
		expect(textOf(c.root)).toContain('已經改過的內容');
	});

	it('A changed line is not overwritten: missing notes re-scan and never show a successful move message', async () => {
		const c = await setup([{ tasks: '- [ ] 訂場地 📅 2026-12-11' }]);
		const original = c.vault.getFileContent(c.files[0]!.path);
		c.vault.setAbstractFile(new TFolder(c.files[0]!.path));
		await press(button(c.row('訂場地'), '▶'));
		expect(c.vault.getFileContent(c.files[0]!.path)).toBe(original);
		expect(c.toast().textContent).toBe('找不到這則筆記');
		expect(c.scan).toHaveBeenCalledTimes(2);
	});

	it('A changed line is not overwritten: write failures restore controls and keep the existing error toast', async () => {
		const c = await setup();
		const original = c.vault.getFileContent(c.files[0]!.path);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(c.vault, 'process').mockRejectedValue(new Error('write failed'));
		await tick(c.row('準備讀書會'));
		expect(c.vault.getFileContent(c.files[0]!.path)).toBe(original);
		expect(c.toast().textContent).toBe('寫入筆記失敗，請再試一次');
		expect(checked(c.row('準備讀書會'))).toBe(false);
		expect(button(c.row('準備讀書會'), '▶').disabled).toBe(false);
	});

	it('Moving a task past the fourth week: notifications use the Saturday rule after a successful write', async () => {
		const c = await setup([{ tasks: '- [ ] 訂場地 📅 2026-12-05' }], { settings: { saturdayCountsAsNextWeek: true } });
		await press(button(c.row('訂場地'), '▶'));
		expect(c.line()).toBe('- [ ] 訂場地 📅 2026-12-12');
		expect(c.toast().textContent).toBe('已移到 12/12，超出這 4 週');
		expect(c.rows()).toEqual([]);
	});

	it('Ticking a task on a phone: only editable rows have controls and writes disable all rows of the note', async () => {
		const c = await setup([{ tasks: '- [ ] 準備讀書會 📅 2026-11-20\n會議紀錄 📅 2026-11-20\n- [x] 完成任務 ✅ 2026-11-20\n- [ ] 第二項 📅 2026-11-20' }]);
		const readonly = c.row('會議紀錄');
		expect(byClass(readonly, 'phone-check')[0]!.disabled).toBe(true);
		expect(byClass(readonly, 'phone-action')).toEqual([]);
		expect(byClass(c.row('完成任務'), 'phone-action')).toEqual([]);
		const process = c.vault.process.bind(c.vault);
		let finish!: () => void;
		vi.spyOn(c.vault, 'process').mockImplementation(async (file, fn) => {
			await new Promise<void>((resolve) => { finish = resolve; });
			return process(file, fn);
		});
		const row = c.row('準備讀書會');
		button(row, '▶').dispatchEvent(new Event('click'));
		expect(find(row, (el) => ['input', 'button'].includes(el.tagName)).every((el) => el.disabled)).toBe(true);
		expect(button(c.row('第二項'), '▶').disabled).toBe(true);
		c.view.render();
		expect(button(c.row('準備讀書會'), '▶').disabled).toBe(true);
		finish();
		await vi.advanceTimersByTimeAsync(0);
		expect(c.line()).toContain('- [ ] 準備讀書會 📅 2026-11-27');
		expect(button(c.row('準備讀書會'), '▶').disabled).toBe(false);
	});
});

describe('overdue tasks and notes', () => {
	it('Scheduling an overdue task into this week', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06' }]);
		expect(c.heading()!.textContent).toBe('▸ 之前還沒做（1）');
		expect(c.rows()).toEqual([]);
		await press(c.heading()!);
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（1）');
		const row = c.row('寄出邀請', c.overdue());
		expect(row.classes.has('phone-late')).toBe(true);
		expect(byClass(row, 'phone-date')[0]!.textContent).toBe('11/6');
		expect(byClass(row, 'phone-action').map(textOf)).toEqual(['排到本週']);
		await press(button(row, '排到本週'));
		expect(c.line()).toBe('- [ ] 寄出邀請 📅 2026-11-20');
		expect(textOf(c.weeks()[0]!)).toContain('寄出邀請');
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（0）');
		expect(c.rows(c.overdue())).toEqual([]);
		await press(c.heading()!);
		expect(c.heading()).toBeUndefined();
	});

	it('Scheduling into this week with the Saturday exception', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06' }], { settings: { scheduleWeekday: 6, saturdayCountsAsNextWeek: true } });
		await press(c.heading()!);
		await press(button(c.row('寄出邀請'), '排到本週'));
		expect(c.line()).toBe('- [ ] 寄出邀請 📅 2026-11-14');
		expect(textOf(c.weeks()[0]!)).toContain('寄出邀請');
	});

	it('A ticked overdue task stays until the section closes', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06\n- [ ] 訂機票 📅 2026-11-10' }]);
		await press(c.heading()!);
		await tick(c.row('寄出邀請', c.overdue()));
		expect(c.line()).toBe('- [x] 寄出邀請 📅 2026-11-06 ✅ 2026-11-20\n- [ ] 訂機票 📅 2026-11-10');
		expect(checked(c.row('寄出邀請', c.overdue()))).toBe(true);
		expect(c.row('寄出邀請', c.overdue()).classes.has('phone-done')).toBe(true);
		expect(c.rows(c.overdue()).map((el) => byClass(el, 'phone-task-text')[0]!.textContent)).toEqual(['寄出邀請', '訂機票']);
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（1）');
		await tick(c.row('寄出邀請', c.overdue()));
		expect(c.row('寄出邀請', c.overdue()).classes.has('phone-late')).toBe(true);
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（2）');
		await tick(c.row('寄出邀請', c.overdue()));
		await press(c.heading()!);
		await press(c.heading()!);
		expect(c.rows(c.overdue()).map((el) => byClass(el, 'phone-task-text')[0]!.textContent)).toEqual(['訂機票']);
	});

	it('A ticked overdue task stays until the section closes: ambiguous retained lines are discarded after an insertion', async () => {
		const done = '- [x] 寄出邀請 📅 2026-11-06 ✅ 2026-11-20';
		const c = await setup([{ tasks: `${done}\n- [ ] 寄出邀請 📅 2026-11-06` }]);
		await press(c.heading()!);
		await tick(c.row('寄出邀請', c.overdue()));
		expect(c.line()).toBe(`${done}\n${done}`);
		const inserted = c.vault.getFileContent(c.files[0]!.path).replace('\n---\n', '\n---\n插入的說明\n');
		c.vault.setFileContent(c.files[0]!.path, inserted);
		await c.fixture.handleExternalChange();
		expect(c.rows(c.overdue())).toEqual([]);
		expect(c.line()).toBe(`插入的說明\n${done}\n${done}`);
		c.vault.setFileContent(c.files[0]!.path, inserted.replace(`${done}\n${done}`, done));
		await c.fixture.handleExternalChange();
		expect(c.rows(c.overdue())).toEqual([]);
	});

	it('A ticked overdue task stays until the section closes: removing a record matches its line number as well as its raw text', async () => {
		const done = '- [x] 寄出邀請 📅 2026-11-06 ✅ 2026-11-20';
		const c = await setup([{ tasks: `${done}\n${done}` }]);
		const project = c.fixture.projects[0]!;
		const toggle = vi.fn(() => Promise.resolve(true));
		const list = new PhoneWeekList({
			projects: () => [project], settings: () => c.settings, today: () => '2026-11-20',
			toggle, shift: () => Promise.resolve(true), openNote: vi.fn(), showToast: vi.fn(),
		});
		const state = list as unknown as {
			retained: Array<{ path: string; line: number; raw: string }>;
			renderRow(container: HTMLElement, project: ProjectRecord, line: ProjectRecord['task_lines'][number], overdue: boolean): void;
		};
		const first = { path: project.path, line: project.task_lines[0]!.line, raw: done };
		const second = { path: project.path, line: project.task_lines[1]!.line, raw: done };
		// 唯一性檢查會隱藏相同行；這裡直接重現移除紀錄的狀態轉換，獨立檢查行號。
		state.retained = [first, second];
		const container = element(new EventTarget());
		state.renderRow(container as unknown as HTMLElement, project, project.task_lines[1]!, true);
		await tick(byClass(container, 'phone-task')[0]!);
		expect(toggle).toHaveBeenCalledWith(project, project.task_lines[1]);
		expect(state.retained).toEqual([first]);
	});

	it('A ticked overdue task stays until the section closes: a failed untick keeps the retained row available to retry', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06' }]);
		await press(c.heading()!);
		await tick(c.row('寄出邀請', c.overdue()));
		const original = c.vault.getFileContent(c.files[0]!.path);
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(c.vault, 'process').mockRejectedValueOnce(new Error('write failed'));
		await tick(c.row('寄出邀請', c.overdue()));
		expect(c.vault.getFileContent(c.files[0]!.path)).toBe(original);
		expect(c.rows(c.overdue())).toHaveLength(1);
		expect(checked(c.row('寄出邀請', c.overdue()))).toBe(true);
		expect(c.toast().textContent).toBe('寫入筆記失敗，請再試一次');
		await tick(c.row('寄出邀請', c.overdue()));
		expect(c.line()).toBe('- [ ] 寄出邀請 📅 2026-11-06');
		expect(c.row('寄出邀請', c.overdue()).classes.has('phone-late')).toBe(true);
	});

	it('Ticking a task on a phone: a pending note stays disabled after line numbers change while other notes remain editable', async () => {
		const c = await setup([
			{ tasks: '- [ ] 準備讀書會 📅 2026-11-20\n- [ ] 同筆記任務 📅 2026-11-20' },
			{ tasks: '- [ ] 另一則筆記任務 📅 2026-11-20' },
		]);
		const process = c.vault.process.bind(c.vault);
		let finish!: () => void;
		const write = vi.spyOn(c.vault, 'process').mockImplementation(async (file, fn) => {
			await new Promise<void>((resolve) => { finish = resolve; });
			return process(file, fn);
		});
		button(c.row('準備讀書會'), '▶').dispatchEvent(new Event('click'));
		expect(button(c.row('同筆記任務'), '▶').disabled).toBe(true);
		expect(button(c.row('另一則筆記任務'), '▶').disabled).toBe(false);
		const original = c.vault.getFileContent(c.files[0]!.path);
		c.vault.setFileContent(c.files[0]!.path, original.replace('\n---\n', '\n---\n插入的說明\n'));
		await c.fixture.handleExternalChange();
		for (const text of ['準備讀書會', '同筆記任務']) {
			expect(find(c.row(text), (el) => ['input', 'button'].includes(el.tagName)).every((el) => el.disabled)).toBe(true);
		}
		expect(button(c.row('另一則筆記任務'), '▶').disabled).toBe(false);
		button(c.row('同筆記任務'), '▶').dispatchEvent(new Event('click'));
		expect(write).toHaveBeenCalledTimes(1);
		finish();
		await vi.advanceTimersByTimeAsync(0);
		expect(c.line()).toBe('插入的說明\n- [ ] 準備讀書會 📅 2026-11-27\n- [ ] 同筆記任務 📅 2026-11-20');
		expect(button(c.row('準備讀書會'), '▶').disabled).toBe(false);
		expect(button(c.row('同筆記任務'), '▶').disabled).toBe(false);
	});

	it('Earlier days of this week are not overdue', async () => {
		const c = await setup([{ tasks: '- [ ] 回覆信件 📅 2026-11-16' }]);
		expect(c.row('回覆信件', c.weeks()[0]).classes.has('phone-open')).toBe(true);
		expect(c.heading()).toBeUndefined();
	});

	it('No overdue tasks, no heading', async () => {
		const c = await setup();
		expect(c.heading()).toBeUndefined();
	});

	it('A ticked overdue task stays until the section closes: the last tick keeps zero and reopening resets retention', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06' }]);
		await press(c.heading()!);
		await tick(c.row('寄出邀請', c.overdue()));
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（0）');
		expect(checked(c.row('寄出邀請', c.overdue()))).toBe(true);
		await c.view.onClose();
		await c.view.onOpen();
		expect(c.heading()).toBeUndefined();
	});

	it('Scheduling an overdue task into this week: note and settings re-renders preserve expansion and scroll', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06' }]);
		await press(c.heading()!);
		c.fixture.contentEl.scrollTop = 180;
		c.fixture.chartEl.scrollLeft = 12;
		c.noteChanged();
		await vi.advanceTimersByTimeAsync(0);
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（1）');
		expect(c.fixture.contentEl.scrollTop).toBe(180);
		expect(c.fixture.chartEl.scrollLeft).toBe(12);
		c.settingsChanged();
		await vi.advanceTimersByTimeAsync(0);
		expect(c.heading()!.textContent).toBe('▾ 之前還沒做（1）');
		expect(c.fixture.contentEl.scrollTop).toBe(180);
	});

	it('Opening a note and going back', async () => {
		const c = await setup([{ tasks: '- [ ] 寄出邀請 📅 2026-11-06\n- [ ] 準備讀書會 📅 2026-11-20' }]);
		await press(byClass(c.weeks()[0]!, 'phone-project-name')[0]!);
		expect(c.leaf.openFile).toHaveBeenCalledWith(c.files[0]);
		expect(c.createLeafBySplit).not.toHaveBeenCalled();
		await press(c.heading()!);
		await press(byClass(c.overdue(), 'phone-project-name')[0]!);
		expect(c.leaf.openFile).toHaveBeenCalledTimes(2);
		// 替身沒有 Obsidian 的返回堆疊，只能驗證重新開啟同一 view 後的清單。
		await c.view.onClose();
		await c.view.onOpen();
		expect(c.weeks()).toHaveLength(4);
		expect(c.heading()!.textContent).toBe('▸ 之前還沒做（1）');
	});

	it('Opening a note and going back: computers and tablets still reuse a split', async () => {
		const c = await setup([], { phone: false, tablet: true });
		const file = new TFile('Projects/範例專案 A.md');
		c.vault.setAbstractFile(file);
		await c.fixture.openProjectNote(file.path);
		await c.fixture.openProjectNote(file.path);
		expect(c.createLeafBySplit).toHaveBeenCalledOnce();
		expect(c.split.openFile).toHaveBeenCalledTimes(2);
		expect(c.leaf.openFile).not.toHaveBeenCalled();
	});

	it('A phone gets the week list: phone styles have scoped touch sizes and wrapping', async () => {
		const c = await setup();
		for (const input of byClass(c.root, 'phone-check')) {
			expect(input.tagName).toBe('input');
			expect(input.parentElement!.tagName).toBe('label');
			expect(input.parentElement!.classes.has('phone-check-hit')).toBe(true);
		}
		const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
		const phone = css.slice(css.indexOf('/* 手機以直向閱讀'));
		const selectors = [...phone.matchAll(/([^{}]+)\{/g)].flatMap((match) => match[1]!.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((selector) => selector.trim()));
		expect(selectors.every((selector) => selector.startsWith('.pd-phone'))).toBe(true);
		for (const selector of ['.phone-check-hit', '.phone-paused', '.phone-action', '.phone-overdue-heading', '.phone-project-name']) {
			const rule = [...phone.matchAll(/([^{}]+)\{([^{}]+)\}/g)].find((match) => match[1]!.includes(selector))!;
			expect(rule[2]).toContain('44px');
		}
		for (const selector of ['.pd-phone .phone-check', '.pd-phone .phone-paused input']) {
			const rules = [...phone.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter((match) => match[1]!.split(',').some((entry) => entry.trim() === selector));
			for (const rule of rules) expect(rule[2]).not.toMatch(/(?:min-|max-)?(?:width|height)\s*:/);
		}
		expect(phone).toContain('overflow-wrap: anywhere');
		expect(phone).toContain('white-space: normal');
		expect(phone).toContain('color: var(--text-dim)');
		expect(phone).toContain('color: var(--overflow-red)');
	});
});
