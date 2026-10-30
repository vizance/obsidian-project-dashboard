import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginDataStore, SETTINGS_SAVE_DELAY_MS } from '../src/core/plugin-data-store';
import { defaultSettings, type PluginData } from '../src/core/settings';

// 假的計時器注入，與 src/core/sync-rules.ts 的 createDebouncer 相同形狀。
const timers = {
	set: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
	clear: (id: number) => clearTimeout(id),
};

interface Harness {
	store: PluginDataStore;
	saved: PluginData[];
	errors: unknown[];
	reasons: string[];
	stored: { value: unknown };
	failNextSave: () => void;
}

function harness(initial: unknown): Harness {
	const saved: PluginData[] = [];
	const errors: unknown[] = [];
	const reasons: string[] = [];
	const stored = { value: initial };
	let failing = false;

	const store = new PluginDataStore({
		load: async () => stored.value,
		save: async (data) => {
			if (failing) {
				failing = false;
				throw new Error('stub save failure');
			}
			saved.push(data);
			stored.value = data;
		},
		timers,
		onSaveError: (err) => errors.push(err),
	});
	store.subscribe((reason) => reasons.push(reason));

	return { store, saved, errors, reasons, stored, failNextSave: () => { failing = true; } };
}

describe('PluginDataStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('falls back to the defaults when the stored data is garbage', async () => {
		const h = harness('not an object');
		await h.store.init();
		expect(h.store.data).toEqual({ categoryOverrides: {}, settings: defaultSettings() });
	});

	// Requirement: Saving one part of plugin data keeps the other.
	it('keeps the settings when a category override is saved', async () => {
		const h = harness({ settings: { projectFolder: 'Work/Projects' } });
		await h.store.init();

		await h.store.saveCategoryOverrides({ 'P-2026 範例專案 A': 'life' });

		expect(h.saved).toHaveLength(1);
		expect(h.saved[0]!.settings.projectFolder).toBe('Work/Projects');
		expect(h.saved[0]!.categoryOverrides).toEqual({ 'P-2026 範例專案 A': 'life' });
		expect(h.reasons).toEqual(['overrides-saved']);
	});

	it('keeps the category overrides when the settings are saved', async () => {
		const h = harness({ categoryOverrides: { 'P-2026 範例專案 A': 'life' } });
		await h.store.init();

		h.store.updateSettings({ ...h.store.data.settings, projectFolder: 'Work/Projects' });
		await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DELAY_MS);

		expect(h.saved).toHaveLength(1);
		expect(h.saved[0]!.categoryOverrides).toEqual({ 'P-2026 範例專案 A': 'life' });
		expect(h.saved[0]!.settings.projectFolder).toBe('Work/Projects');
	});

	it('leaves the stored overrides unchanged and rejects when the override save fails', async () => {
		const h = harness({ categoryOverrides: { 'P-2026 範例專案 A': 'life' } });
		await h.store.init();
		h.failNextSave();

		await expect(h.store.saveCategoryOverrides({})).rejects.toThrow('stub save failure');
		expect(h.store.data.categoryOverrides).toEqual({ 'P-2026 範例專案 A': 'life' });
		expect(h.saved).toHaveLength(0);
	});

	it('normalizes a settings change into the in-memory data immediately', async () => {
		const h = harness({});
		await h.store.init();

		h.store.updateSettings({ ...h.store.data.settings, projectFolder: '/Work/Projects/ ' });

		// 掃描馬上就用新值，不等 400 ms 的存檔。
		expect(h.store.data.settings.projectFolder).toBe('Work/Projects');
		expect(h.saved).toHaveLength(0);
	});

	// Requirement: Settings changes apply to open dashboards — a burst of edits
	// produces exactly one save, 400 ms after the last one.
	it('merges a burst of settings changes into one save after the last change', async () => {
		const h = harness({});
		await h.store.init();

		h.store.updateSettings({ ...h.store.data.settings, scheduleWeekday: 1 });
		await vi.advanceTimersByTimeAsync(200);
		h.store.updateSettings({ ...h.store.data.settings, scheduleWeekday: 2 });
		await vi.advanceTimersByTimeAsync(200);
		h.store.updateSettings({ ...h.store.data.settings, scheduleWeekday: 3 });
		await vi.advanceTimersByTimeAsync(399);
		expect(h.saved).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(1);
		expect(h.saved).toHaveLength(1);
		expect(h.saved[0]!.settings.scheduleWeekday).toBe(3);
		expect(h.reasons).toEqual(['settings-saved']);
	});

	it('restores the last saved settings, reports, and notifies when the save fails', async () => {
		const h = harness({ settings: { projectFolder: 'Work/Projects' } });
		await h.store.init();
		h.failNextSave();

		h.store.updateSettings({ ...h.store.data.settings, projectFolder: 'Typo' });
		await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DELAY_MS);

		expect(h.store.data.settings.projectFolder).toBe('Work/Projects');
		expect(h.errors).toHaveLength(1);
		expect(h.reasons).toEqual(['settings-reverted']);
	});

	it('restores only the settings and keeps an override saved in between', async () => {
		const h = harness({ settings: { scheduleWeekday: 5 } });
		await h.store.init();
		await h.store.saveCategoryOverrides({ 'P-2026 範例專案 A': 'life' });
		h.failNextSave();

		h.store.updateSettings({ ...h.store.data.settings, scheduleWeekday: 1 });
		await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DELAY_MS);

		expect(h.store.data.settings.scheduleWeekday).toBe(5);
		expect(h.store.data.categoryOverrides).toEqual({ 'P-2026 範例專案 A': 'life' });
	});

	// Scenario: Synced data arriving during a pending edit wins.
	it('discards a pending edit when synced data arrives and never writes it later', async () => {
		const h = harness({ settings: { scheduleWeekday: 5 } });
		await h.store.init();

		h.store.updateSettings({ ...h.store.data.settings, scheduleWeekday: 1 });
		await vi.advanceTimersByTimeAsync(200);

		h.stored.value = { settings: { scheduleWeekday: 5 } };
		await h.store.reloadFromOutside();

		expect(h.store.data.settings.scheduleWeekday).toBe(5);
		expect(h.reasons).toEqual(['reloaded']);

		// 被取消的修改之後也不會被寫回去。
		await vi.advanceTimersByTimeAsync(5000);
		expect(h.saved).toHaveLength(0);
		expect(h.store.data.settings.scheduleWeekday).toBe(5);
	});

	it('normalizes the reloaded data and keeps the last saved copy independent', async () => {
		const h = harness({});
		await h.store.init();

		h.stored.value = { settings: { projectFolder: '', scheduleWeekday: '6' } };
		await h.store.reloadFromOutside();

		expect(h.store.data.settings.projectFolder).toBe('Projects');
		expect(h.store.data.settings.scheduleWeekday).toBe(5);

		// 改到記憶體中的資料不會動到「上次存成功的值」：存檔失敗後還原得回去。
		h.store.data.settings.classificationRules.length = 0;
		h.failNextSave();
		h.store.updateSettings({ ...h.store.data.settings, projectFolder: 'Typo' });
		await vi.advanceTimersByTimeAsync(SETTINGS_SAVE_DELAY_MS);
		expect(h.store.data.settings.classificationRules).toHaveLength(10);
	});

	it('stops notifying an unsubscribed listener', async () => {
		const h = harness({});
		await h.store.init();
		const listener = vi.fn();
		const unsubscribe = h.store.subscribe(listener);

		unsubscribe();
		await h.store.saveCategoryOverrides({});

		expect(listener).not.toHaveBeenCalled();
	});
});
