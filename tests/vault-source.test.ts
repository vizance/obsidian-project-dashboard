import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Imported from the stub module directly (not the 'obsidian' specifier) so these
// classes type-check against the stub's own declarations. The vitest alias makes
// 'obsidian' resolve to this same file at runtime, so instances constructed here
// are `instanceof` the same TFile/TFolder that src/vault-source.ts checks against.
import { Plugin, TFile, TFolder, Vault } from './stubs/obsidian';
import { defaultSettings, type DashboardSettings } from '../src/core/settings';
import { VaultSource } from '../src/vault-source';

const FOLDER = 'Projects';

// 可變的設定來源：VaultSource 必須每次掃描、每次事件都重新讀，所以測試改這個
// 物件就等於使用者在設定頁改了設定。
function settingsHolder(folder = FOLDER): { settings: DashboardSettings } {
	return { settings: { ...defaultSettings(), projectFolder: folder } };
}

function setupVault(folder = FOLDER): Vault {
	const vault = new Vault();
	vault.setAbstractFile(new TFolder(folder));
	return vault;
}

function addProjectFile(vault: Vault, name: string, content: string, folderPath = FOLDER): void {
	const path = `${folderPath}/${name}`;
	const file = new TFile(path);
	const folder = vault.getAbstractFileByPath(folderPath);
	if (!(folder instanceof TFolder)) throw new Error('test setup: project folder missing');
	folder.children.push(file);
	vault.setAbstractFile(file);
	vault.setFileContent(path, content);
}

describe('VaultSource.scan', () => {
	it('reports missing-folder when the project folder does not exist', async () => {
		const vault = new Vault();
		const source = new VaultSource(vault, () => ({}), () => settingsHolder().settings);
		const result = await source.scan('2026-10-25');
		expect(result).toEqual({ status: 'missing-folder', folder: FOLDER });
	});

	it('does not scan files inside a subfolder', async () => {
		const vault = setupVault();
		addProjectFile(vault, '🚧 P-2026 線上課程.md', '');
		const taskFolderPath = `${FOLDER}/Task 任務筆記`;
		const taskFolder = new TFolder(taskFolderPath);
		vault.setAbstractFile(taskFolder);
		const taskFile = new TFile(`${taskFolderPath}/✅ T-2026 校正逐字稿.md`);
		taskFolder.children.push(taskFile);
		vault.setAbstractFile(taskFile);
		vault.setFileContent(taskFile.path, '');
		// The subfolder itself is also a direct child of the project folder, but
		// it is not a TFile, so it must be skipped by the extension/type filter.
		const projectFolder = vault.getAbstractFileByPath(FOLDER);
		if (!(projectFolder instanceof TFolder)) throw new Error('test setup: project folder missing');
		projectFolder.children.push(taskFolder);

		const source = new VaultSource(vault, () => ({}), () => settingsHolder().settings);
		const result = await source.scan('2026-10-25');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.projects).toHaveLength(1);
		expect(result.projects[0]!.name).toBe('P-2026 線上課程');
	});

	it('skips a note whose read fails and still returns the others', async () => {
		const vault = setupVault();
		addProjectFile(vault, '🚧 P-2026 A 專案.md', '');
		addProjectFile(vault, '🚧 P-2026 B 專案.md', '');
		vault.setReadFailure(`${FOLDER}/🚧 P-2026 A 專案.md`);

		const source = new VaultSource(vault, () => ({}), () => settingsHolder().settings);
		const result = await source.scan('2026-10-25');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.projects.map((p) => p.name)).toEqual(['P-2026 B 專案']);
	});

	// dashboard-obsidian-plugin: "Every scan SHALL use the setting's value at the
	// time of the scan" — the folder must not be captured at construction time.
	it('scans the new folder after the setting changes', async () => {
		const vault = setupVault();
		addProjectFile(vault, '🚧 P-2026 範例專案 A.md', '');
		vault.setAbstractFile(new TFolder('Work/Projects'));
		addProjectFile(vault, '🚧 P-2026 範例專案 B.md', '', 'Work/Projects');

		const holder = settingsHolder();
		const source = new VaultSource(vault, () => ({}), () => holder.settings);

		const first = await source.scan('2026-10-25');
		if (first.status !== 'ok') throw new Error('unreachable');
		expect(first.projects.map((p) => p.name)).toEqual(['P-2026 範例專案 A']);

		holder.settings = { ...holder.settings, projectFolder: 'Work/Projects' };
		const second = await source.scan('2026-10-25');
		if (second.status !== 'ok') throw new Error('unreachable');
		expect(second.projects.map((p) => p.name)).toEqual(['P-2026 範例專案 B']);
	});

	it('uses the current classification rules and exclusions for every scan', async () => {
		const vault = setupVault();
		addProjectFile(vault, '🚧 P-2026 範例內訓課程.md', '');
		addProjectFile(vault, '🚧 P-2026 範例草稿.md', '');

		const holder = settingsHolder();
		const source = new VaultSource(vault, () => ({}), () => holder.settings);

		const first = await source.scan('2026-10-25');
		if (first.status !== 'ok') throw new Error('unreachable');
		// 預設規則：`內訓` 排在 `課程` 之前。
		expect(first.projects.map((p) => [p.name, p.category])).toEqual([
			['P-2026 範例內訓課程', 'corporate'],
			['P-2026 範例草稿', 'other'],
		]);

		holder.settings = {
			...holder.settings,
			classificationRules: [{ text: '課程', category: 'online_course' }],
			excludedProjects: ['範例草稿'],
		};
		const second = await source.scan('2026-10-25');
		if (second.status !== 'ok') throw new Error('unreachable');
		expect(second.projects.map((p) => [p.name, p.category])).toEqual([
			['P-2026 範例內訓課程', 'online_course'],
		]);
	});

	it('reports the current folder in the missing-folder result', async () => {
		const holder = settingsHolder();
		const source = new VaultSource(setupVault(), () => ({}), () => holder.settings);
		holder.settings = { ...holder.settings, projectFolder: 'Projets' };
		expect(await source.scan('2026-10-25')).toEqual({ status: 'missing-folder', folder: 'Projets' });
	});
});

describe('VaultSource change notifications', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// src/vault-source.ts calls window.setTimeout/clearTimeout per the
		// obsidianmd/prefer-window-timers lint rule; the vitest `node` test
		// environment has no `window`, so stub it onto globalThis here.
		(globalThis as { window?: typeof globalThis }).window = globalThis;
	});

	afterEach(() => {
		vi.useRealTimers();
		delete (globalThis as { window?: typeof globalThis }).window;
	});

	it('does not notify for an irrelevant path but notifies once 400ms after a relevant one', () => {
		const vault = setupVault();
		const source = new VaultSource(vault, () => ({}), () => settingsHolder().settings);
		source.registerVaultEvents(new Plugin());

		const listener = vi.fn();
		source.onChange(listener);

		vault.trigger('modify', { path: 'Calendar/Journal/2026-10-25.md' });
		vi.advanceTimersByTime(1000);
		expect(listener).not.toHaveBeenCalled();

		vault.trigger('modify', { path: `${FOLDER}/🚧 P-2026 A 專案.md` });
		vi.advanceTimersByTime(399);
		expect(listener).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	// Scenario: A changed folder setting changes which notes count.
	it('follows the folder setting when deciding which changes are relevant', () => {
		const vault = setupVault();
		const holder = settingsHolder();
		const source = new VaultSource(vault, () => ({}), () => holder.settings);
		source.registerVaultEvents(new Plugin());

		const listener = vi.fn();
		source.onChange(listener);

		holder.settings = { ...holder.settings, projectFolder: 'Work/Projects' };

		vault.trigger('modify', { path: `${FOLDER}/🚧 P-2026 範例專案 A.md` });
		vi.advanceTimersByTime(1000);
		expect(listener).not.toHaveBeenCalled();

		vault.trigger('modify', { path: 'Work/Projects/🚧 P-2026 範例專案 B.md' });
		vi.advanceTimersByTime(400);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('schedules nothing when there are no listeners', () => {
		const vault = setupVault();
		const source = new VaultSource(vault, () => ({}), () => settingsHolder().settings);
		source.registerVaultEvents(new Plugin());

		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		vault.trigger('modify', { path: `${FOLDER}/🚧 P-2026 A 專案.md` });
		expect(setTimeoutSpy).not.toHaveBeenCalled();
	});
});
