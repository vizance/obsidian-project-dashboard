import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { DashboardSettingTab } from '../src/settings-tab';
import { PluginDataStore } from '../src/core/plugin-data-store';
import { type CalendarSetting } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { Setting, SettingsElement, SettingsText, Vault } from './stubs/obsidian';

const LINK = 'https://calendar.example.com/private-abc/basic.ics';
const SAVED = 'Link saved. Paste a new link to change it.';
const ERROR = 'This is not a calendar link. It should start with https:// or webcal://.';

async function setup(calendars: CalendarSetting[] = [{ name: '', secretId: '' }], stored: Record<string, string> = {}) {
	const secrets = new Map(Object.entries(stored));
	const setSecret = vi.fn((id: string, link: string) => { secrets.set(id, link); });
	const app = {
		vault: new Vault(),
		secretStorage: {
			setSecret,
			getSecret: (id: string) => secrets.get(id) ?? null,
			listSecrets: () => [...secrets.keys()],
		},
	};
	const save = vi.fn(async (_data: unknown) => {});
	const store = new PluginDataStore({
		load: () => Promise.resolve({ settings: { calendars } }),
		save,
		timers: { set: (fn, ms) => Number(setTimeout(fn, ms)), clear: (id) => clearTimeout(id) },
		onSaveError: () => { throw new Error('Unexpected save failure'); },
	});
	await store.init();
	const tab = new DashboardSettingTab(app as unknown as App, { store } as unknown as ProjectDashboardPlugin);
	const renderer: { display(): void } = tab;
	renderer.display();
	const rows = Setting.instances.filter((setting) => setting.settingEl.classes.has('pd-calendar-row'));
	return { tab, rows, store, save, secrets, setSecret };
}

function type(text: SettingsText, value: string): void {
	text.inputEl.value = value;
	text.inputEl.dispatchEvent(new Event('input'));
}

function enter(text: SettingsText, isComposing = false): Event {
	const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Enter', isComposing });
	text.inputEl.dispatchEvent(event);
	return event;
}

function error(row: Setting): SettingsElement {
	return row.controlEl.children.find((el) => el.classes.has('pd-calendar-error'))!;
}

describe('Calendars settings', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) });
		Setting.instances = [];
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('uses the exact description, hints and controls without exposing stored links or IDs', async () => {
		const { rows } = await setup([
			{ name: '', secretId: '' },
			{ name: '範例行事曆', secretId: 'calendar-a' },
			{ name: '', secretId: 'calendar-b' },
		], { 'calendar-a': LINK });
		const heading = Setting.instances.find((setting) => setting.name === 'Calendars')!;
		expect(heading.descEl.textContent).toBe('Show events from your calendars at the top of the month view. The plugin only reads your calendars. It never changes them.');
		expect(heading.descEl.children.map((el) => el.textContent)).toEqual([
			'Google Calendar: open the calendar\'s settings and copy "Secret address in iCal format" (iCal 格式的私密網址).',
			'iCloud: share the calendar as a public calendar and copy its link.',
		]);
		expect(rows.map((row) => row.texts[1]!.inputEl.placeholder)).toEqual([
			'Paste the calendar link here', SAVED, 'This computer has no link yet. Paste it here.',
		]);
		for (const row of rows) {
			expect(row.texts).toHaveLength(2);
			expect(row.texts[0]!.inputEl.placeholder).toBe('Calendar name');
			expect(row.texts[1]!.getValue()).toBe('');
			expect(row.extraButtons.map((button) => [button.icon, button.label])).toEqual([['trash', 'Delete']]);
		}
		expect(Setting.instances.at(-1)!.buttons[0]!.label).toBe('Add a calendar');
	});

	it('reads paste after the default action, stores only the ID after 400 ms, and clears only this link', async () => {
		const { tab, rows, store, save, setSecret } = await setup([{ name: '', secretId: '' }, { name: '', secretId: '' }]);
		const display = vi.spyOn(tab, 'display');
		type(rows[0]!.texts[0]!, '家人行事曆');
		type(rows[1]!.texts[0]!, '範例 行事曆 ');
		type(rows[1]!.texts[1]!, 'unfinished link');
		const link = rows[0]!.texts[1]!;
		link.inputEl.dispatchEvent(new Event('paste'));
		expect(setSecret).not.toHaveBeenCalled();
		// 模擬瀏覽器的預設貼上動作：paste 送出後，才改 value 並送出 input。
		type(link, `  ${LINK}  `);
		await vi.advanceTimersByTimeAsync(0);
		const id = store.data.settings.calendars[0]!.secretId;
		expect(id).toMatch(/^project-dashboard-calendar-[a-z0-9]{8}$/);
		expect(setSecret).toHaveBeenCalledExactlyOnceWith(id, LINK);
		expect(link.getValue()).toBe('');
		expect(link.inputEl.placeholder).toBe(SAVED);
		expect(store.data.settings.calendars[0]!.name).toBe('家人行事曆');
		expect(rows[1]!.texts.map((text) => text.getValue())).toEqual(['範例 行事曆 ', 'unfinished link']);
		expect(display).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(399);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(save).toHaveBeenCalledOnce();
		expect(JSON.stringify(save.mock.calls[0]![0])).not.toMatch(/https:|webcal:|calendar\.example\.com/);
	});

	it.each(['enter', 'change'])('saves webcal on %s using the existing ID without displaying the old link', async (trigger) => {
		const { rows, setSecret, store } = await setup([{ name: '範例', secretId: 'calendar-a' }], { 'calendar-a': LINK });
		const text = rows[0]!.texts[1]!;
		const replacement = 'webcal://calendar.example.com/new.ics';
		type(text, ` ${replacement} `);
		if (trigger === 'enter') expect(enter(text).defaultPrevented).toBe(true);
		else text.inputEl.dispatchEvent(new Event('change'));
		expect(setSecret).toHaveBeenCalledExactlyOnceWith('calendar-a', replacement);
		expect(store.data.settings.calendars[0]!.secretId).toBe('calendar-a');
		expect(text.getValue()).toBe('');
		expect(text.inputEl.placeholder).toBe(SAVED);
	});

	it('rejects a wrong pasted link until its text changes and leaves the existing saved link untouched', async () => {
		const { rows, setSecret, store, secrets } = await setup();
		const row = rows[0]!;
		const text = row.texts[1]!;
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, 'calendar.example.com/feed.ics');
		await vi.advanceTimersByTimeAsync(0);
		expect(setSecret).not.toHaveBeenCalled();
		expect(store.data.settings.calendars[0]!.secretId).toBe('');
		expect(error(row).hidden).toBe(false);
		expect(error(row).textContent).toBe(ERROR);
		type(text, LINK);
		expect(error(row).hidden).toBe(true);
		enter(text);
		const id = store.data.settings.calendars[0]!.secretId;
		setSecret.mockClear();
		type(text, 'http://calendar.example.com/feed.ics');
		text.inputEl.dispatchEvent(new Event('change'));
		expect(setSecret).not.toHaveBeenCalled();
		expect(secrets.get(id)).toBe(LINK);
		expect(error(row).hidden).toBe(false);
	});

	it('does nothing for empty input and ignores Enter during composition', async () => {
		const { rows, setSecret } = await setup();
		const text = rows[0]!.texts[1]!;
		type(text, '   ');
		enter(text);
		text.inputEl.dispatchEvent(new Event('change'));
		expect(error(rows[0]!).hidden).toBe(true);
		type(text, LINK);
		expect(enter(text, true).defaultPrevented).toBe(false);
		expect(setSecret).not.toHaveBeenCalled();
	});

	it('saves just once when change fires before the deferred paste handler', async () => {
		const { rows, setSecret } = await setup();
		const text = rows[0]!.texts[1]!;
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, LINK);
		text.inputEl.dispatchEvent(new Event('change'));
		await vi.advanceTimersByTimeAsync(0);
		expect(setSecret).toHaveBeenCalledOnce();
	});

	it('avoids IDs belonging to other calendars and to unrelated saved values', async () => {
		let calls = 0;
		const random = vi.spyOn(Math, 'random').mockImplementation(() => Math.floor(calls++ / 8) / 36);
		try {
			const { rows, store, secrets } = await setup([
				{ name: '', secretId: '' }, { name: '', secretId: 'project-dashboard-calendar-aaaaaaaa' },
			], { 'project-dashboard-calendar-bbbbbbbb': 'https://calendar.example.com/other.ics' });
			type(rows[0]!.texts[1]!, LINK);
			enter(rows[0]!.texts[1]!);
			expect(store.data.settings.calendars[0]!.secretId).toBe('project-dashboard-calendar-cccccccc');
			expect(secrets.get('project-dashboard-calendar-bbbbbbbb')).toBe('https://calendar.example.com/other.ics');
		} finally {
			random.mockRestore();
		}
	});

	it.each([
		['project-dashboard-calendar-a1b2c3d4', true], ['calendar-a', false], ['', false],
	])('deletes %j and clears only a value created by the plugin', async (id, shouldClear) => {
		const { rows, store, setSecret, secrets } = await setup([
			{ name: '範例', secretId: id }, { name: '其他範例', secretId: 'calendar-b' },
		], { [id]: LINK, 'calendar-b': 'https://calendar.example.com/other.ics' });
		rows[0]!.extraButtons[0]!.callback();
		expect(store.data.settings.calendars).toEqual([{ name: '其他範例', secretId: 'calendar-b' }]);
		if (shouldClear) expect(setSecret).toHaveBeenCalledExactlyOnceWith(id, '');
		else expect(setSecret).not.toHaveBeenCalled();
		expect(secrets.get('calendar-b')).toBe('https://calendar.example.com/other.ics');
	});

	it('discards a pending paste after the row is deleted, even if its index is reused', async () => {
		const { rows, store, setSecret } = await setup([{ name: '', secretId: '' }, { name: '其他範例', secretId: '' }]);
		const text = rows[0]!.texts[1]!;
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, LINK);
		rows[0]!.extraButtons[0]!.callback();
		await vi.advanceTimersByTimeAsync(0);
		expect(setSecret).not.toHaveBeenCalled();
		expect(store.data.settings.calendars).toEqual([{ name: '其他範例', secretId: '' }]);
	});

	it('adds an empty calendar row', async () => {
		const { store } = await setup([]);
		Setting.instances.at(-1)!.buttons[0]!.callback();
		expect(store.data.settings.calendars).toEqual([{ name: '', secretId: '' }]);
	});
});
