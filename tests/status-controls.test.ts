import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { ProjectDashboardView } from '../src/view';
import { MonthView } from '../src/month-view';
import { weeksOfMonth } from '../src/core/months';
import { scanProjectNote, type ProjectRecord, type ProjectStatus } from '../src/core/scan';
import { defaultSettings } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { VaultSource } from '../src/vault-source';
import { SettingsElement, TFile, TFolder, Vault } from './stubs/obsidian';

function record(status: ProjectStatus = 'active', filename = '🚧 P-20260824 範例專案.md'): ProjectRecord {
	return { ...scanProjectNote({ filename, text: '---\n開始日期: 2026-08-24\n預計結束日期: 2026-08-31\n---', path: `Projects/${filename}` }, {
		overrides: {}, today: '2026-08-24', settings: defaultSettings(),
	})!, status };
}

function find(el: SettingsElement, matches: (el: SettingsElement) => boolean): SettingsElement[] {
	return [...(matches(el) ? [el] : []), ...el.children.flatMap((child) => find(child, matches))];
}

function setup(projects = [record()]) {
	const vault = new Vault();
	const renameFile = vi.fn(() => Promise.resolve());
	const scan = vi.fn(() => Promise.resolve({ status: 'ok', projects }));
	const view = new ProjectDashboardView({} as WorkspaceLeaf, { scan } as unknown as VaultSource, {
		store: { data: { settings: defaultSettings(), categoryOverrides: {} } },
	} as unknown as ProjectDashboardPlugin);
	const fixture = view as unknown as {
		app: unknown;
		contentEl: SettingsElement;
		containerEl: unknown;
		chartEl: SettingsElement;
		popoverEl: SettingsElement;
		projects: ProjectRecord[];
		showPaused: boolean;
		showClosed: boolean;
		shownYear: number;
		today: string;
		categoryOrder: string[];
		scale: 'year' | 'month';
		registerDomEvent(target: unknown, type: string, callback: (event: Event) => void): void;
		buildScaleControls: () => void;
		buildHelpPanel: () => void;
		setHelpPanelVisible: () => void;
		buildLayout(): void;
		rescanAndRender(): Promise<void>;
		renderChart: () => void;
		renderLegend: () => void;
		renderYearChart(): void;
		visibleSortedProjects(): ProjectRecord[];
		handleStatusChange(select: HTMLSelectElement): Promise<void>;
		registerStatusChange(): void;
		registerProjectNameClick(): void;
		bindWeekPopoverWindowListeners(doc: Document): void;
		closeWeekPopover: () => void;
		openProjectNote: (path: string) => void;
		showToast: (text: string, error?: boolean) => void;
	};
	const listeners: Array<{ target: unknown; type: string; callback: (event: Event) => void }> = [];
	const doc = {
		body: new SettingsElement(), defaultView: null,
		addEventListener: (type: string, callback: (event: Event) => void) => listeners.push({ target: doc, type, callback }),
		removeEventListener: vi.fn(),
	};
	Object.assign(fixture, {
		app: { vault, fileManager: { renameFile } },
		contentEl: new SettingsElement(), containerEl: { ownerDocument: doc }, projects,
		today: '2026-08-24', shownYear: 2026, categoryOrder: ['other'],
		registerDomEvent: (target: unknown, type: string, callback: (event: Event) => void) => listeners.push({ target, type, callback }),
		buildScaleControls: vi.fn(), buildHelpPanel: vi.fn(), setHelpPanelVisible: vi.fn(),
		renderChart: vi.fn(), renderLegend: vi.fn(), showToast: vi.fn(),
		closeWeekPopover: vi.fn(), openProjectNote: vi.fn(),
	});
	fixture.buildLayout();
	const fire = (target: unknown, type: string, element: SettingsElement) => {
		for (const listener of listeners.filter((entry) => entry.target === target && entry.type === type)) {
			listener.callback({ target: element, composedPath: () => [] } as unknown as Event);
		}
	};
	const input = (id: string) => find(fixture.contentEl, (el) => el.attributes.get('id') === id)[0]!;
	const select = new SettingsElement();
	select.addClass('status-select');
	select.dataset.path = projects[0]?.path ?? '';
	select.value = 'pending';
	return { fixture, vault, renameFile, scan, select, fire, input, doc };
}

function htmlSelect(select: SettingsElement): HTMLSelectElement {
	return select as unknown as HTMLSelectElement;
}

describe('paused controls', () => {
	it('starts unchecked, updates the count after scans, and hides the whole label at zero', async () => {
		const paused = record('pending', '⏳ P-20260601 範例專案 B.md');
		const projects = [record(), paused, { ...record('pending'), start: null }];
		const { fixture, input, fire, scan } = setup(projects);
		await fixture.rescanAndRender();
		const checkbox = input('show-paused');
		const label = checkbox.parentElement!;
		expect(checkbox.checked).toBe(false);
		expect(label.hidden).toBe(false);
		expect(label.children[1]!.textContent).toBe('顯示暫停（1）');
		expect(fixture.visibleSortedProjects()).toHaveLength(1);
		checkbox.checked = true;
		fire(checkbox, 'change', checkbox);
		expect(fixture.visibleSortedProjects()).toHaveLength(2);
		projects.push(record('pending', '⏳ P-20260701 範例專案 C.md'));
		await fixture.rescanAndRender();
		expect(label.children[1]!.textContent).toBe('顯示暫停（2）');
		projects.splice(0, projects.length, record());
		await fixture.rescanAndRender();
		expect(label.hidden).toBe(true);
		expect(scan).toHaveBeenCalledTimes(3);
		fixture.buildLayout();
		expect(input('show-paused').checked).toBe(false);
		expect(fixture.showPaused).toBe(false);
	});

	it('counts only dated, unskipped notes directly inside the configured project folder', async () => {
		const { fixture, input } = setup([]);
		const vault = new Vault();
		const folder = new TFolder('Projects');
		vault.setAbstractFile(folder);
		const settings = { ...defaultSettings(), excludedProjects: ['範例草稿'] };
		for (const [name, text, direct] of [
			['⏳ P-20260601 範例專案 B.md', '---\n開始日期: 2026-06-01\n預計結束日期: 2026-06-30\n---', true],
			['⏳ P-20260701 範例專案 C.md', '---\n開始日期: 2026-07-01\n預計結束日期: 2026-07-31\n---', true],
			['⏳ P-20260801 範例草稿.md', '', true],
			['⏳ 範例未排日期.md', '', true],
			['⏳ P-20260801 範例子資料夾.md', '', false],
		] as const) {
			const file = new TFile(`${direct ? 'Projects' : 'Projects/Subfolder'}/${name}`);
			vault.setAbstractFile(file);
			vault.setFileContent(file.path, text);
			if (direct) folder.children.push(file);
		}
		const source = new VaultSource(vault, () => ({}), () => settings);
		const result = await source.scan('2026-08-24');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('missing fixture folder');
		fixture.projects = result.projects;
		// 用真實掃描結果更新同一個控制列，避免測試只驗證手填的暫停數字。
		const view = fixture as unknown as { render(): void };
		view.render();
		expect(input('show-paused').parentElement!.children[1]!.textContent).toBe('顯示暫停（2）');
	});

	it('changes edit visibility through CSS without scanning or rendering', () => {
		const { fixture, input, fire, scan } = setup();
		const checkbox = input('edit-categories');
		expect(checkbox.parentElement!.textContent).toBe('編輯分類與狀態');
		expect(checkbox.checked).toBe(false);
		checkbox.checked = true;
		fire(checkbox, 'change', checkbox);
		expect(fixture.contentEl.classes.has('editing-categories')).toBe(true);
		checkbox.checked = false;
		fire(checkbox, 'change', checkbox);
		expect(fixture.contentEl.classes.has('editing-categories')).toBe(false);
		expect(scan).not.toHaveBeenCalled();
		expect(fixture.renderChart).not.toHaveBeenCalled();
	});

	it.each(['year', 'month'] as const)('labels only paused projects after their names in the %s view', (scale) => {
		const paused = record('pending', '⏳ P-20260601 範例專案 B.md');
		const active = record();
		const { fixture } = setup([paused, active]);
		fixture.showPaused = true;
		if (scale === 'year') fixture.renderYearChart();
		else new MonthView({
			projects: () => fixture.visibleSortedProjects(), weeks: () => weeksOfMonth(2026, 8),
			settings: defaultSettings, today: () => fixture.today, categoryOrder: () => ['other'], calendarRow: () => null,
		}).render(fixture.chartEl as unknown as HTMLElement);
		const heads = find(fixture.chartEl, (el) => el.classes.has('proj-cell'));
		expect(heads).toHaveLength(2);
		for (const project of [paused, active]) {
			const head = heads.find((el) => find(el, (child) => child.classes.has('name') && child.dataset.path === project.path).length > 0)!;
			const badges = find(head, (el) => el.classes.has('pause-badge'));
			if (project.status === 'pending') {
				expect(badges).toHaveLength(1);
				expect(badges[0]!.textContent).toBe('⏳ 暫停');
				const nameIndex = head.children.findIndex((el) => el.classes.has('name'));
				expect(head.children[nameIndex + 1]).toBe(badges[0]);
			} else {
				expect(badges).toHaveLength(0);
			}
		}
	});

	it.each(['year', 'month'] as const)('renders the same status options and pending row class in the %s view', (scale) => {
		const { fixture } = setup([record('pending', '⏳ P-20260601 範例專案 B.md')]);
		fixture.showPaused = true;
		if (scale === 'year') fixture.renderYearChart();
		else new MonthView({
			projects: () => fixture.visibleSortedProjects(), weeks: () => weeksOfMonth(2026, 8),
			settings: defaultSettings, today: () => fixture.today, categoryOrder: () => ['other'], calendarRow: () => null,
		}).render(fixture.chartEl as unknown as HTMLElement);
		const rows = find(fixture.chartEl, (el) => el.classes.has('status-pending'));
		expect(rows).toHaveLength(1);
		const select = find(rows[0]!, (el) => el.classes.has('status-select'))[0]!;
		expect(select.value).toBe('pending');
		expect(select.children.map((el) => [el.value, el.textContent])).toEqual([
			['active', '🚧 進行中'], ['pending', '⏳ 暫停'], ['done', '✅ 完成'], ['cancelled', '❌ 取消'],
		]);
		expect(find(rows[0]!, (el) => el.classes.has('cat-select'))).toHaveLength(1);
	});
});

describe('status changes', () => {
	it('renames in the same folder through the file manager and waits for the rename scan', async () => {
		const { fixture, vault, renameFile, scan, select } = setup();
		const file = new TFile(select.dataset.path!);
		vault.setAbstractFile(file);
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).toHaveBeenCalledExactlyOnceWith(file, 'Projects/⏳ P-20260824 範例專案.md');
		expect(fixture.renderChart).not.toHaveBeenCalled();
		expect(scan).not.toHaveBeenCalled();
		expect(select.disabled).toBe(false);
	});

	it('adds a prefix to a note without a status symbol and leaves unchanged status alone', async () => {
		const { fixture, vault, renameFile, select } = setup([record('active', 'P-20260824 範例專案.md')]);
		const file = new TFile(select.dataset.path!);
		vault.setAbstractFile(file);
		select.value = 'active';
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).not.toHaveBeenCalled();
		select.value = 'pending';
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).toHaveBeenCalledExactlyOnceWith(file, 'Projects/⏳ P-20260824 範例專案.md');
	});

	it('resumes a paused project with the original active filename', async () => {
		const { fixture, vault, renameFile, select } = setup([record('pending', '⏳ P-20260824 範例專案.md')]);
		const file = new TFile(select.dataset.path!);
		vault.setAbstractFile(file);
		select.value = 'active';
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).toHaveBeenCalledExactlyOnceWith(file, 'Projects/🚧 P-20260824 範例專案.md');
	});

	it.each(['file', 'folder'])('rejects an existing %s at the destination and restores the selected status', async (kind) => {
		const { fixture, vault, renameFile, select } = setup();
		vault.setAbstractFile(new TFile(select.dataset.path!));
		const path = 'Projects/✅ P-20260824 範例專案.md';
		vault.setAbstractFile(kind === 'file' ? new TFile(path) : new TFolder(path));
		select.value = 'done';
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).not.toHaveBeenCalled();
		expect(fixture.showToast).toHaveBeenCalledWith('已經有同名的筆記，狀態沒有改', true);
		expect(select.value).toBe('active');
	});

	it('uses the existing missing-note message and restores the selected status', async () => {
		const { fixture, renameFile, select } = setup();
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).not.toHaveBeenCalled();
		expect(fixture.showToast).toHaveBeenCalledWith('找不到這則筆記', true);
		expect(select.value).toBe('active');
	});

	it('restores the selected status and enables retry after a rename fails', async () => {
		const { fixture, vault, renameFile, select } = setup();
		vault.setAbstractFile(new TFile(select.dataset.path!));
		renameFile.mockRejectedValueOnce(new Error('failed'));
		await fixture.handleStatusChange(htmlSelect(select));
		expect(fixture.showToast).toHaveBeenCalledWith('狀態沒有改，請再試一次', true);
		expect(select.value).toBe('active');
		expect(select.disabled).toBe(false);
	});

	it('ignores repeated input while the file manager is still renaming', async () => {
		const { fixture, vault, renameFile, select } = setup();
		vault.setAbstractFile(new TFile(select.dataset.path!));
		let finish!: () => void;
		renameFile.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
		const renaming = fixture.handleStatusChange(htmlSelect(select));
		expect(select.disabled).toBe(true);
		await fixture.handleStatusChange(htmlSelect(select));
		expect(renameFile).toHaveBeenCalledOnce();
		finish();
		await renaming;
		expect(select.disabled).toBe(false);
	});

	it.each(['year', 'month'] as const)('keeps status-select clicks out of note and popover handlers in the %s view', (scale) => {
		const { fixture, select, fire, doc } = setup();
		fixture.scale = scale;
		fixture.registerProjectNameClick();
		fixture.bindWeekPopoverWindowListeners(doc as unknown as Document);
		const option = select.createEl('option');
		fire(fixture.chartEl, 'click', option);
		fire(doc, 'click', option);
		expect(fixture.openProjectNote).not.toHaveBeenCalled();
		expect(fixture.closeWeekPopover).not.toHaveBeenCalled();
	});
});
