import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { DashboardSettingTab } from '../src/settings-tab';
import { PluginDataStore } from '../src/core/plugin-data-store';
import type { PluginData } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { Setting, TFolder, Vault } from './stubs/obsidian';

const { constructions } = vi.hoisted(() => ({
	constructions: [] as Array<{ app: App; inputEl: HTMLInputElement; onPick: (path: string) => void }>,
}));

// 只替換設定頁與清單之間的接線；篩選函式仍保留真正的實作。
vi.mock('../src/folder-suggest', async (importOriginal) => {
	const original = await importOriginal<typeof import('../src/folder-suggest')>();
	return {
		...original,
		ProjectFolderSuggest: class {
			constructor(app: App, inputEl: HTMLInputElement, onPick: (path: string) => void) {
				constructions.push({ app, inputEl, onPick });
			}
		},
	};
});

describe('Project folder suggestion settings', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Setting.instances = [];
		constructions.length = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('Picking a folder saves it', async () => {
		const vault = new Vault();
		vault.setAbstractFile(new TFolder('Work/Projects'));
		const app = { vault } as unknown as App;
		const save = vi.fn(async (_data: PluginData) => {});
		const store = new PluginDataStore({
			load: () => Promise.resolve({ settings: { projectFolder: 'Projects', calendars: [] } }),
			save,
			timers: { set: (fn, ms) => Number(setTimeout(fn, ms)), clear: (id) => clearTimeout(id) },
			onSaveError: () => { throw new Error('Unexpected save failure'); },
		});
		await store.init();
		const tab = new DashboardSettingTab(app, { store } as unknown as ProjectDashboardPlugin);
		try {
			const renderer: { display(): void } = tab;
			renderer.display();
			const folder = Setting.instances.find((setting) => setting.name === 'Project folder')!;
			const hint = folder.controlEl.children.find((el) => el.classes.has('pd-setting-hint'))!;
			expect(hint.textContent).toBe(`Can't find this folder.`);
			expect(hint.hidden).toBe(false);
			expect(constructions).toHaveLength(1);
			const pick = constructions[0]!;
			expect(pick.app).toBe(app);
			expect(pick.inputEl).toBe(folder.texts[0]!.inputEl);
			pick.onPick('Work/Projects');
			expect(hint.hidden).toBe(true);
			await vi.advanceTimersByTimeAsync(399);
			expect(save).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(1);
			expect(save).toHaveBeenCalledOnce();
			expect(save.mock.calls[0]![0].settings.projectFolder).toBe('Work/Projects');
			expect(store.data.settings.projectFolder).toBe('Work/Projects');
			expect(hint.hidden).toBe(true);
		} finally {
			tab.hide();
			store.dispose();
		}
	});
});
