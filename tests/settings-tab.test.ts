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

async function setup(calendars: CalendarSetting[] = [{ name: '', secretId: '', color: '' }], stored: Record<string, string> = {}) {
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
	const refresh = vi.fn(() => Promise.resolve());
	const tab = new DashboardSettingTab(app as unknown as App, { store, calendars: { refresh } } as unknown as ProjectDashboardPlugin);
	const renderer: { display(): void } = tab;
	renderer.display();
	const rows = Setting.instances.filter((setting) => setting.settingEl.classes.has('pd-calendar-row'));
	return { tab, rows, store, save, secrets, setSecret, refresh };
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

describe('Project folder settings', () => {
	beforeEach(() => {
		Setting.instances = [];
	});

	it('describes how to tap or click Project folder to pick from a list', async () => {
		const { tab } = await setup([]);
		try {
			const folder = Setting.instances.find((setting) => setting.name === 'Project folder')!;
			expect(folder.descEl.textContent).toBe('The folder where your project notes live. Only notes right inside this folder are used. Notes in folders inside it are skipped. Tap or click the box to pick a folder from a list.');
		} finally {
			tab.hide();
		}
	});
});

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
			{ name: '', secretId: '', color: '' },
			{ name: '範例行事曆', secretId: 'calendar-a', color: '' },
			{ name: '', secretId: 'calendar-b', color: '' },
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
		const { tab, rows, store, save, setSecret } = await setup([{ name: '', secretId: '', color: '' }, { name: '', secretId: '', color: '' }]);
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
		const { rows, setSecret, store } = await setup([{ name: '範例', secretId: 'project-dashboard-calendar-abcd1234', color: '' }], { 'project-dashboard-calendar-abcd1234': LINK });
		const text = rows[0]!.texts[1]!;
		const replacement = 'webcal://calendar.example.com/new.ics';
		type(text, ` ${replacement} `);
		if (trigger === 'enter') expect(enter(text).defaultPrevented).toBe(true);
		else text.inputEl.dispatchEvent(new Event('change'));
		expect(setSecret).toHaveBeenCalledExactlyOnceWith('project-dashboard-calendar-abcd1234', replacement);
		expect(store.data.settings.calendars[0]!.secretId).toBe('project-dashboard-calendar-abcd1234');
		expect(text.getValue()).toBe('');
		expect(text.inputEl.placeholder).toBe(SAVED);
	});

	it('refreshes once when a new link is pasted for a calendar with an existing ID', async () => {
		const { rows, setSecret, refresh, secrets, store } = await setup([{ name: '範例', secretId: 'project-dashboard-calendar-abcd1234', color: '' }], { 'project-dashboard-calendar-abcd1234': LINK });
		const text = rows[0]!.texts[1]!;
		const replacement = 'https://calendar.example.com/new.ics';
		refresh.mockImplementation(() => {
			expect(secrets.get('project-dashboard-calendar-abcd1234')).toBe(replacement);
			return Promise.resolve();
		});
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, replacement);
		await vi.advanceTimersByTimeAsync(0);
		text.inputEl.dispatchEvent(new Event('change'));
		await vi.advanceTimersByTimeAsync(400);
		expect(setSecret).toHaveBeenCalledExactlyOnceWith('project-dashboard-calendar-abcd1234', replacement);
		expect(store.data.settings.calendars[0]!.secretId).toBe('project-dashboard-calendar-abcd1234');
		expect(refresh).toHaveBeenCalledOnce();
	});

	it('does not directly refresh when a link is pasted for a calendar without an ID', async () => {
		const { rows, setSecret, refresh, store, save } = await setup();
		const text = rows[0]!.texts[1]!;
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, LINK);
		await vi.advanceTimersByTimeAsync(0);
		text.inputEl.dispatchEvent(new Event('change'));
		await vi.advanceTimersByTimeAsync(400);
		const id = store.data.settings.calendars[0]!.secretId;
		expect(id).toMatch(/^project-dashboard-calendar-[a-z0-9]{8}$/);
		expect(setSecret).toHaveBeenCalledExactlyOnceWith(id, LINK);
		expect(save).toHaveBeenCalledOnce();
		expect(refresh).not.toHaveBeenCalled();
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
				{ name: '', secretId: '', color: '' }, { name: '', secretId: 'project-dashboard-calendar-aaaaaaaa', color: '' },
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
			{ name: '範例', secretId: id, color: '' }, { name: '其他範例', secretId: 'calendar-b', color: '' },
		], { [id]: LINK, 'calendar-b': 'https://calendar.example.com/other.ics' });
		rows[0]!.extraButtons[0]!.callback();
		expect(store.data.settings.calendars).toEqual([{ name: '其他範例', secretId: 'calendar-b', color: '' }]);
		if (shouldClear) expect(setSecret).toHaveBeenCalledExactlyOnceWith(id, '');
		else expect(setSecret).not.toHaveBeenCalled();
		expect(secrets.get('calendar-b')).toBe('https://calendar.example.com/other.ics');
	});

	it('discards a pending paste after the row is deleted, even if its index is reused', async () => {
		const { rows, store, setSecret } = await setup([{ name: '', secretId: '', color: '' }, { name: '其他範例', secretId: '', color: '' }]);
		const text = rows[0]!.texts[1]!;
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, LINK);
		rows[0]!.extraButtons[0]!.callback();
		await vi.advanceTimersByTimeAsync(0);
		expect(setSecret).not.toHaveBeenCalled();
		expect(store.data.settings.calendars).toEqual([{ name: '其他範例', secretId: '', color: '' }]);
	});

	it('adds an empty calendar row', async () => {
		const { store } = await setup([]);
		Setting.instances.at(-1)!.buttons[0]!.callback();
		expect(store.data.settings.calendars).toEqual([{ name: '', secretId: '', color: '' }]);
	});

	it('shows the position default or stored color with a Color tooltip and label', async () => {
		const { rows } = await setup([
			{ name: '工作', secretId: 'a', color: '' },
			{ name: '家庭', secretId: 'b', color: '' },
			{ name: '其他', secretId: 'c', color: '#8e5bd6' },
		]);
		expect(rows.map((row) => row.colors[0]!.getValue())).toEqual(['#4a7fd4', '#2f9e6e', '#8e5bd6']);
		for (const row of rows) {
			expect(row.colors).toHaveLength(1);
			const input = row.colors[0]!.inputEl;
			expect(input.attributes.get('data-tooltip')).toBe('Color');
			expect(input.attributes.get('aria-label')).toBe('Color');
			expect(row.controlEl.children.indexOf(input)).toBeGreaterThan(row.controlEl.children.indexOf(row.texts[1]!.inputEl));
		}
	});

	it('saves the picked color after 400 ms without redrawing or clearing unfinished text', async () => {
		const { tab, rows, store, save, refresh } = await setup([
			{ name: '工作', secretId: 'a', color: '' }, { name: '', secretId: '', color: '' },
		]);
		const display = vi.spyOn(tab, 'display');
		type(rows[1]!.texts[0]!, '還在輸入的名稱 ');
		type(rows[1]!.texts[1]!, 'unfinished link');
		type(rows[0]!.colors[0]!, '#8E5BD6');
		expect(store.data.settings.calendars[0]).toEqual({ name: '工作', secretId: 'a', color: '#8e5bd6' });
		await vi.advanceTimersByTimeAsync(399);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(save).toHaveBeenCalledOnce();
		expect(store.data.settings.calendars[1]!.name).toBe('還在輸入的名稱');
		expect(rows[1]!.texts.map((text) => text.getValue())).toEqual(['還在輸入的名稱 ', 'unfinished link']);
		expect(display).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
	});
});


describe('calendar link security', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('window', { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) });
		Setting.instances = [];
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('A secret chosen with the old picker stays untouched', async () => {
		let calls = 0;
		vi.spyOn(Math, 'random').mockImplementation(() => Math.floor(calls++ / 8) / 36);
		const { rows, store, secrets, refresh } = await setup([
			{ name: '範例', secretId: 'other-plugin-credential', color: '' },
			{ name: '', secretId: 'project-dashboard-calendar-aaaaaaaa', color: '' },
		], { 'other-plugin-credential': 'keep-me', 'project-dashboard-calendar-bbbbbbbb': LINK });
		const text = rows[0]!.texts[1]!;
		type(text, 'https://calendar.example.com/new.ics');
		enter(text);
		expect(secrets.get('other-plugin-credential')).toBe('keep-me');
		const id = store.data.settings.calendars[0]!.secretId;
		expect(id).toMatch(/^project-dashboard-calendar-[a-z0-9]{8}$/);
		expect(id).toBe('project-dashboard-calendar-cccccccc');
		expect(secrets.get(id)).toBe('https://calendar.example.com/new.ics');
		expect(refresh).not.toHaveBeenCalled();
	});

	it('reuses an owned ID and refreshes exactly once', async () => {
		const id = 'project-dashboard-calendar-a1b2c3d4';
		const { rows, store, setSecret, refresh } = await setup([{ name: '', secretId: id, color: '' }], { [id]: LINK });
		const text = rows[0]!.texts[1]!;
		type(text, 'https://calendar.example.com/new.ics');
		enter(text);
		expect(setSecret).toHaveBeenCalledExactlyOnceWith(id, 'https://calendar.example.com/new.ics');
		expect(store.data.settings.calendars[0]!.secretId).toBe(id);
		expect(refresh).toHaveBeenCalledOnce();
	});

	it('hides links and disables spell checking and autocomplete', async () => {
		const { rows } = await setup();
		const input = rows[0]!.texts[1]!.inputEl;
		expect(input.type).toBe('password');
		expect(input).toHaveProperty('spellcheck', false);
		expect(input).toHaveProperty('autocomplete', 'off');
	});

	it('A rejected link does not stay on screen', async () => {
		const { rows, setSecret } = await setup();
		const row = rows[0]!;
		const text = row.texts[1]!;
		text.inputEl.dispatchEvent(new Event('paste'));
		type(text, 'HTTPS://calendar.example.com/private-demo/basic.ics');
		await vi.advanceTimersByTimeAsync(0);
		expect(text.getValue()).toBe('');
		expect(error(row).hidden).toBe(false);
		expect(error(row).textContent).toBe(ERROR);
		expect(setSecret).not.toHaveBeenCalled();
	});
});
