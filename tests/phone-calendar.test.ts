import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestUrl, type App, type PluginManifest } from 'obsidian';
import { CalendarStore } from '../src/calendar-store';
import { type CalendarSetting, type PluginData } from '../src/core/settings';
import ProjectDashboardPlugin from '../src/main';
import { DashboardSettingTab } from '../src/settings-tab';
import { Platform, Setting, Vault } from './stubs/obsidian';

vi.mock('obsidian', async (importOriginal) => ({
	...await importOriginal<typeof import('./stubs/obsidian')>(),
	requestUrl: vi.fn(() => Promise.resolve({ status: 200, text: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' })),
}));

const CALENDARS: CalendarSetting[] = [
	{ name: '工作', secretId: 'work-calendar', color: '#4a7fd4' },
];

async function setupPlugin() {
	// 即使手機沒有可用的密碼保管，也必須能載入外掛與修改其他設定。
	const secretStorage = vi.fn(() => { throw new Error('Secret storage is unavailable'); });
	const app = { vault: new Vault(), get secretStorage(): never { return secretStorage(); } };
	const plugin = new ProjectDashboardPlugin(app as unknown as App, {} as PluginManifest);
	const addCommand = vi.fn<(command: { id: string; callback?: () => void }) => void>();
	const saveData = vi.fn<(data: PluginData) => Promise<void>>(() => Promise.resolve());
	Object.assign(plugin, {
		app,
		loadData: () => Promise.resolve({ settings: { calendars: CALENDARS } }),
		saveData,
		registerView: vi.fn(),
		addSettingTab: vi.fn(),
		addRibbonIcon: vi.fn(),
		addCommand,
	});
	await plugin.onload();
	return { plugin, app, addCommand, saveData, secretStorage };
}

describe('phone calendar boundaries', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {
			setTimeout: (fn: () => void, ms: number) => Number(setTimeout(fn, ms)),
			clearTimeout: (id: number) => clearTimeout(id),
		});
		Setting.instances = [];
	});

	afterEach(() => {
		Platform.isPhone = false;
		Platform.isTablet = false;
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('A phone never fetches: both refresh entry points leave state and listeners untouched', async () => {
		const request = vi.fn(() => Promise.resolve({ status: 200, text: '' }));
		const getSecret = vi.fn(() => 'https://calendar.example.com/work.ics');
		const calendars = vi.fn(() => CALENDARS);
		const now = vi.fn(() => new Date());
		const store = new CalendarStore({ request, getSecret, calendars, now, enabled: () => !Platform.isPhone });
		const notify = vi.fn();
		store.subscribe(notify);
		const before = store.state;
		Platform.isPhone = true;
		await store.refresh();
		await store.refreshIfCalendarsChanged();
		expect(request).not.toHaveBeenCalled();
		expect(getSecret).not.toHaveBeenCalled();
		expect(calendars).not.toHaveBeenCalled();
		expect(now).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
		expect(store.state).toEqual(before);
		store.dispose();
	});

	it('A phone never fetches: a deferred refresh checks before starting', async () => {
		const request = vi.fn(() => Promise.resolve({ status: 200, text: '' }));
		const getSecret = vi.fn(() => 'https://calendar.example.com/work.ics');
		const store = new CalendarStore({
			request, getSecret, calendars: () => CALENDARS, now: () => new Date(), enabled: () => !Platform.isPhone,
		});
		const notify = vi.fn();
		store.subscribe(notify);
		const before = store.state;
		const pending = store.refresh();
		Platform.isPhone = true;
		await pending;
		expect(request).not.toHaveBeenCalled();
		expect(getSecret).not.toHaveBeenCalled();
		expect(notify).not.toHaveBeenCalled();
		expect(store.state).toEqual(before);
		store.dispose();
	});

	it('A phone never fetches: onload omits the command and settings saves and reloads make no request', async () => {
		Platform.isPhone = true;
		const { plugin, addCommand, secretStorage, saveData } = await setupPlugin();
		try {
			expect(addCommand.mock.calls.map(([command]) => command.id)).toEqual(['open-dashboard']);
			await plugin.calendars.refresh();
			await plugin.calendars.refreshIfCalendarsChanged();
			plugin.store.updateSettings({ ...plugin.store.data.settings, projectFolder: 'Example projects' });
			await vi.advanceTimersByTimeAsync(400);
			expect(saveData).toHaveBeenCalledOnce();
			await plugin.onExternalSettingsChange();
			expect(requestUrl).not.toHaveBeenCalled();
			expect(secretStorage).not.toHaveBeenCalled();
			expect(plugin.calendars.state.started).toBe(false);
		} finally {
			plugin.onunload();
		}
	});

	it.each([false, true])('A phone never fetches: computers and tablets still register Refresh calendars (tablet: %s)', async (isTablet) => {
		Platform.isTablet = isTablet;
		const { plugin, addCommand } = await setupPlugin();
		try {
			expect(addCommand.mock.calls.map(([command]) => command.id)).toEqual(['open-dashboard', 'refresh-calendars']);
		} finally {
			plugin.onunload();
		}
	});

	it('Settings on a phone', async () => {
		Platform.isPhone = true;
		const { plugin, app, secretStorage } = await setupPlugin();
		const tab = new DashboardSettingTab(app as unknown as App, plugin);
		const renderer: { display(): void } = tab;
		try {
			renderer.display();
			const index = Setting.instances.findIndex((setting) => setting.name === 'Calendars');
			expect(index).toBeGreaterThanOrEqual(0);
			const section = Setting.instances.slice(index);
			expect(section).toHaveLength(1);
			expect(section[0]!.descEl.textContent).toBe('Calendar events show on a computer or tablet. Add your calendars there.');
			expect(section[0]!.descEl.children).toEqual([]);
			expect(section[0]!.controlEl.children).toEqual([]);
			expect(section[0]!.texts).toEqual([]);
			expect(section[0]!.colors).toEqual([]);
			expect(section[0]!.buttons).toEqual([]);
			expect(section[0]!.extraButtons).toEqual([]);
			expect(secretStorage).not.toHaveBeenCalled();
		} finally {
			tab.hide();
			plugin.onunload();
		}
	});

	it('Other settings keep the calendars', async () => {
		Platform.isPhone = true;
		const { plugin, app, saveData, secretStorage } = await setupPlugin();
		const tab = new DashboardSettingTab(app as unknown as App, plugin);
		const renderer: { display(): void } = tab;
		try {
			renderer.display();
			const folder = Setting.instances.find((setting) => setting.name === 'Project folder')!.texts[0]!;
			folder.inputEl.value = 'Example projects';
			folder.inputEl.dispatchEvent(new Event('input'));
			await vi.advanceTimersByTimeAsync(400);
			expect(saveData).toHaveBeenCalledOnce();
			expect(saveData.mock.calls[0]![0].settings.projectFolder).toBe('Example projects');
			expect(saveData.mock.calls[0]![0].settings.calendars).toEqual(CALENDARS);
			expect(plugin.store.data.settings.calendars).toEqual(CALENDARS);
			expect(secretStorage).not.toHaveBeenCalled();
			expect(requestUrl).not.toHaveBeenCalled();
		} finally {
			tab.hide();
			plugin.onunload();
		}
	});

	it('The manifest allows phones and tablets', () => {
		const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8')) as { isDesktopOnly: boolean };
		expect(manifest.isDesktopOnly).toBe(false);
	});
});
