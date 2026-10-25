import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Imported from the stub module directly (not the 'obsidian' specifier) so these
// classes type-check against the stub's own declarations. The vitest alias makes
// 'obsidian' resolve to this same file at runtime, so instances constructed here
// are `instanceof` the same TFile/TFolder that src/vault-source.ts checks against.
import { Plugin, TFile, TFolder, Vault } from './stubs/obsidian';
import { VaultSource } from '../src/vault-source';

const FOLDER = 'Projects';

function setupVault(): Vault {
	const vault = new Vault();
	const folder = new TFolder(FOLDER);
	vault.setAbstractFile(folder);
	return vault;
}

function addProjectFile(vault: Vault, name: string, content: string): void {
	const path = `${FOLDER}/${name}`;
	const file = new TFile(path);
	const folder = vault.getAbstractFileByPath(FOLDER);
	if (!(folder instanceof TFolder)) throw new Error('test setup: project folder missing');
	folder.children.push(file);
	vault.setAbstractFile(file);
	vault.setFileContent(path, content);
}

describe('VaultSource.scan', () => {
	it('reports missing-folder when the project folder does not exist', async () => {
		const vault = new Vault();
		const source = new VaultSource(vault, () => ({}), FOLDER);
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

		const source = new VaultSource(vault, () => ({}), FOLDER);
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

		const source = new VaultSource(vault, () => ({}), FOLDER);
		const result = await source.scan('2026-10-25');
		expect(result.status).toBe('ok');
		if (result.status !== 'ok') throw new Error('unreachable');
		expect(result.projects.map((p) => p.name)).toEqual(['P-2026 B 專案']);
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
		const source = new VaultSource(vault, () => ({}), FOLDER);
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

	it('schedules nothing when there are no listeners', () => {
		const vault = setupVault();
		const source = new VaultSource(vault, () => ({}), FOLDER);
		source.registerVaultEvents(new Plugin());

		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
		vault.trigger('modify', { path: `${FOLDER}/🚧 P-2026 A 專案.md` });
		expect(setTimeoutSpy).not.toHaveBeenCalled();
	});
});
