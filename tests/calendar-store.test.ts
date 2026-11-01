import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CalendarStore,
	SECRET_MISSING_REASON,
	UNREACHABLE_REASON,
	UNREADABLE_REASON,
	httpFailureReason,
	type CalendarResponse,
} from '../src/calendar-store';
import {
	INVALID_ADDRESS_REASON,
	eventLineText,
	occurrencesForWeek,
	occurrencesInRange,
} from '../src/core/calendar';
import type { CalendarSetting } from '../src/core/settings';

// 測試完全不連網也不碰 Obsidian：請求、鑰匙、時鐘都是假的，iCalendar 文字寫在這裡。
// 連結一律用 calendar.example.com 這種示範網址，真實的私密網址不進任何檔案。
const WORK_ADDRESS = 'https://calendar.example.com/work/basic.ics';
const FAMILY_ADDRESS = 'https://calendar.example.com/family/basic.ics';

function ics(uid: string, summary: string, start: string, end: string): string {
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//dashboard//test//EN',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTART:${start}`,
		`DTEND:${end}`,
		`SUMMARY:${summary}`,
		'END:VEVENT',
		'END:VCALENDAR',
	].join('\r\n');
}

const WORK_ICS = ics('work-1', '讀書會', '20261106T133000', '20261106T150000');
const FAMILY_ICS = ics('family-1', '家庭聚餐', '20261107T180000', '20261107T200000');

// 月視圖顯示 2026-11 時的範圍：W45 的星期一到 W49 的下一個星期一。
const NOVEMBER_FROM = '2026-11-02';
const NOVEMBER_TO = '2026-12-07';

interface Harness {
	store: CalendarStore;
	urls: string[];
	notifications: number;
	setCalendars(calendars: CalendarSetting[]): void;
	setSecret(id: string, value: string | null): void;
	setNow(now: Date): void;
	// true 時請求會停在半路，等 release() 才回來，可以觀察讀取進行中的行為。
	hold(value: boolean): void;
	release(): Promise<void>;
}

interface HarnessOptions {
	calendars?: CalendarSetting[];
	secrets?: Record<string, string>;
	respond?: (url: string) => CalendarResponse;
}

function harness(options: HarnessOptions = {}): Harness {
	let calendars: CalendarSetting[] = options.calendars ?? [{ name: '工作', secretId: 'work-calendar' }];
	const secrets = new Map<string, string>(Object.entries(options.secrets ?? { 'work-calendar': WORK_ADDRESS }));
	let now = new Date(2026, 10, 6, 15, 20);
	const urls: string[] = [];
	const respond = options.respond ?? ((url) => ({ status: 200, text: url === FAMILY_ADDRESS ? FAMILY_ICS : WORK_ICS }));
	let holding = false;
	let pending: Array<() => void> = [];

	const result: Harness = {
		store: new CalendarStore({
			request: (url) => {
				urls.push(url);
				if (!holding) return Promise.resolve(respond(url));
				return new Promise<CalendarResponse>((resolve) => {
					pending.push(() => resolve(respond(url)));
				});
			},
			getSecret: (id) => secrets.get(id) ?? null,
			now: () => now,
			calendars: () => calendars,
		}),
		urls,
		notifications: 0,
		setCalendars: (next) => {
			calendars = next;
		},
		setSecret: (id, value) => {
			if (value === null) secrets.delete(id);
			else secrets.set(id, value);
		},
		setNow: (next) => {
			now = next;
		},
		hold: (value) => {
			holding = value;
		},
		release: async () => {
			const waiting = pending;
			pending = [];
			for (const resolve of waiting) resolve();
			await flush();
		},
	};
	result.store.subscribe(() => {
		result.notifications++;
	});
	return result;
}

// 讓已經排好的工作跑完，不用假計時器：一輪 macrotask 之後，排著的 microtask
// 都跑過了，下一次讀取也已經發出它的請求。
function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function linesForWeek(store: CalendarStore, week: string): string[] {
	const occurrences = occurrencesInRange(store.state.sources, NOVEMBER_FROM, NOVEMBER_TO);
	return occurrencesForWeek(occurrences, week).map(eventLineText);
}

describe('CalendarStore', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// Requirement: When calendars are fetched — Scenario: No calendar, no network
	it('makes no request when no calendar is configured', async () => {
		const h = harness({ calendars: [], secrets: {} });
		await h.store.refresh();
		expect(h.urls).toEqual([]);
		expect(h.store.state.started).toBe(false);
		expect(h.notifications).toBe(0);
	});

	it('makes no request when every calendar row has an empty secret ID', async () => {
		const h = harness({ calendars: [{ name: '工作', secretId: '' }, { name: '', secretId: '' }], secrets: {} });
		await h.store.refresh();
		expect(h.urls).toEqual([]);
		expect(h.store.state.started).toBe(false);
		expect(h.store.state.sources).toEqual([]);
	});

	it('fetches a configured calendar and keeps its events ready to expand', async () => {
		const h = harness();
		await h.store.refresh();
		expect(h.urls).toEqual([WORK_ADDRESS]);
		expect(h.store.state.sources.map((source) => ({ index: source.index, name: source.name }))).toEqual([
			{ index: 0, name: '工作' },
		]);
		expect(linesForWeek(h.store, '2026-W45')).toEqual(['11/6（五）13:30 讀書會']);
	});

	// Requirement: When calendars are fetched — Scenario: A failure keeps the earlier events
	it('keeps the earlier events when a later fetch fails', async () => {
		let status = 200;
		const h = harness({ respond: () => ({ status, text: WORK_ICS }) });
		await h.store.refresh();
		status = 404;
		await h.store.refresh();
		expect(linesForWeek(h.store, '2026-W45')).toEqual(['11/6（五）13:30 讀書會']);
		expect(h.store.state.failures).toEqual([{ displayName: '工作', reason: '讀取失敗（HTTP 404）' }]);
	});

	// Requirement: When calendars are fetched — Scenario: Removing a calendar keeps the others' events
	it('drops a removed calendar’s events and keeps the others', async () => {
		let failing = false;
		const h = harness({
			calendars: [
				{ name: '工作', secretId: 'work-calendar' },
				{ name: '家庭', secretId: 'family-calendar' },
			],
			secrets: { 'work-calendar': WORK_ADDRESS, 'family-calendar': FAMILY_ADDRESS },
			respond: (url) => ({
				status: failing ? 500 : 200,
				text: url === FAMILY_ADDRESS ? FAMILY_ICS : WORK_ICS,
			}),
		});
		await h.store.refresh();
		expect(linesForWeek(h.store, '2026-W45')).toEqual(['11/6（五）13:30 讀書會', '11/7（六）18:00 家庭聚餐']);

		h.setCalendars([{ name: '家庭', secretId: 'family-calendar' }]);
		failing = true;
		await h.store.refresh();
		expect(h.store.state.sources.map((source) => ({ index: source.index, name: source.name }))).toEqual([
			{ index: 0, name: '家庭' },
		]);
		expect(linesForWeek(h.store, '2026-W45')).toEqual(['11/7（六）18:00 家庭聚餐']);
		expect(h.store.state.failures).toEqual([{ displayName: '家庭', reason: '讀取失敗（HTTP 500）' }]);
	});

	// Requirement: When calendars are fetched — Scenario: Repeated presses make one extra fetch
	it('runs exactly one more fetch when it is asked again while running', async () => {
		const h = harness();
		h.hold(true);
		const done = h.store.refresh();
		await flush();
		expect(h.urls.length).toBe(1);
		expect(h.store.state.running).toBe(true);

		void h.store.refresh();
		void h.store.refresh();
		void h.store.refresh();
		await h.release();
		expect(h.urls.length).toBe(2);

		await h.release();
		await done;
		expect(h.urls.length).toBe(2);
		expect(h.store.state.running).toBe(false);
	});

	// Requirement: Calendar links are kept in Obsidian's secret storage — webcal 換成 https。
	it('fetches a webcal address over https', async () => {
		const h = harness({ secrets: { 'work-calendar': '  webcal://calendar.example.com/work/basic.ics  ' } });
		await h.store.refresh();
		expect(h.urls).toEqual([WORK_ADDRESS]);
		expect(h.store.state.failures).toEqual([]);
	});

	// Requirement: When calendars are fetched — 五種讀不到的原因。
	describe('failure reasons', () => {
		const rows: Array<{ label: string; options: HarnessOptions; reason: string }> = [
			{
				label: 'no value stored for the secret ID',
				options: { secrets: {} },
				reason: SECRET_MISSING_REASON,
			},
			{
				label: 'an address that is not https or webcal',
				options: { secrets: { 'work-calendar': 'http://calendar.example.com/work/basic.ics' } },
				reason: INVALID_ADDRESS_REASON,
			},
			{
				label: 'a status outside 200–299',
				options: { respond: () => ({ status: 403, text: '' }) },
				reason: httpFailureReason(403),
			},
			{
				label: 'a request that throws',
				options: {
					respond: () => {
						throw new Error(`stub network failure for ${WORK_ADDRESS}`);
					},
				},
				reason: UNREACHABLE_REASON,
			},
			{
				label: 'text that is not an iCalendar object',
				options: { respond: () => ({ status: 200, text: 'not a calendar' }) },
				reason: UNREADABLE_REASON,
			},
		];

		for (const row of rows) {
			it(`reports ${row.label} as ${row.reason}`, async () => {
				const h = harness(row.options);
				await h.store.refresh();
				expect(h.store.state.failures).toEqual([{ displayName: '工作', reason: row.reason }]);
				expect(h.store.state.sources).toEqual([]);
			});
		}

		it('names an unnamed calendar by its position', async () => {
			const h = harness({
				calendars: [{ name: '工作', secretId: 'work-calendar' }, { name: '', secretId: 'family-calendar' }],
				secrets: { 'work-calendar': WORK_ADDRESS, 'family-calendar': 'http://calendar.example.com/family.ics' },
			});
			await h.store.refresh();
			expect(h.store.state.failures).toEqual([{ displayName: '行事曆 2', reason: INVALID_ADDRESS_REASON }]);
		});
	});

	it('never puts the address in a reason, in the state, or in the console', async () => {
		const spies = [
			vi.spyOn(console, 'log').mockImplementation(() => {}),
			vi.spyOn(console, 'warn').mockImplementation(() => {}),
			vi.spyOn(console, 'error').mockImplementation(() => {}),
		];
		const h = harness({
			respond: () => {
				throw new Error(`stub network failure for ${WORK_ADDRESS}`);
			},
		});
		await h.store.refresh();
		const state = h.store.state;
		const reported = JSON.stringify({
			finishedAt: state.finishedAt,
			failures: state.failures,
			names: state.sources.map((source) => source.name),
		});
		expect(reported).not.toContain('calendar.example.com');
		for (const spy of spies) expect(spy).not.toHaveBeenCalled();
	});

	it('reports the local time the last fetch finished', async () => {
		const h = harness();
		h.setNow(new Date(2026, 10, 6, 9, 5));
		await h.store.refresh();
		expect(h.store.state.finishedAt).toBe('09:05');
		expect(h.store.state.started).toBe(true);
	});

	it('notifies when a fetch starts and when it finishes', async () => {
		const h = harness();
		h.hold(true);
		const done = h.store.refresh();
		await flush();
		expect(h.notifications).toBe(1);
		await h.release();
		await done;
		expect(h.notifications).toBe(2);
	});

	// Requirement: When calendars are fetched — 卸載後回來的回應與排著的讀取都丟掉。
	it('drops a late response, the queued fetch, and every notification after dispose', async () => {
		const h = harness();
		h.hold(true);
		const done = h.store.refresh();
		await flush();
		void h.store.refresh();
		const before = h.notifications;

		h.store.dispose();
		await h.release();
		await done;

		expect(h.urls.length).toBe(1);
		expect(h.notifications).toBe(before);
		expect(h.store.state.sources).toEqual([]);
		expect(h.store.state.finishedAt).toBeNull();

		await h.store.refresh();
		expect(h.urls.length).toBe(1);
	});

	// Requirement: When calendars are fetched — 設定變了才重新讀取。
	describe('refreshIfCalendarsChanged', () => {
		it('fetches when the calendars differ from the ones used by the last fetch', async () => {
			const h = harness();
			await h.store.refresh();
			h.setCalendars([{ name: '工作用', secretId: 'work-calendar' }]);
			await h.store.refreshIfCalendarsChanged();
			expect(h.urls.length).toBe(2);
			expect(h.store.state.sources[0]?.name).toBe('工作用');
		});

		it('does not fetch when the calendars are unchanged', async () => {
			const h = harness();
			await h.store.refresh();
			await h.store.refreshIfCalendarsChanged();
			expect(h.urls.length).toBe(1);
		});
	});
});
