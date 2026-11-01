import { describe, expect, it } from 'vitest';
import {
	eventLineText,
	normalizeCalendarAddress,
	occurrencesForWeek,
	occurrencesInRange,
	parseCalendar,
	type CalendarSource,
	type EventOccurrence,
} from '../src/core/calendar';

// Asia/Taipei 全年 UTC+8，所以一段固定偏移的定義就夠了。放在每個行事曆裡，
// 才真的走「用行事曆內的 VTIMEZONE 讀 TZID」那條路。
const TAIPEI_VTIMEZONE = [
	'BEGIN:VTIMEZONE',
	'TZID:Asia/Taipei',
	'BEGIN:STANDARD',
	'DTSTART:19700101T000000',
	'TZOFFSETFROM:+0800',
	'TZOFFSETTO:+0800',
	'TZNAME:CST',
	'END:STANDARD',
	'END:VTIMEZONE',
].join('\r\n');

function ics(...events: string[][]): string {
	const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//dashboard//test//EN', TAIPEI_VTIMEZONE];
	for (const event of events) lines.push('BEGIN:VEVENT', ...event, 'END:VEVENT');
	lines.push('END:VCALENDAR');
	return lines.join('\r\n');
}

function source(text: string, index = 0, name = '工作'): CalendarSource {
	return { index, name, calendar: parseCalendar(text) };
}

// W44–W49 蓋住規格例子用到的每一週（2026-10-26 到 2026-12-07）。
const TABLE_WEEKS = ['2026-W44', '2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49'];
const TABLE_FROM = '2026-10-26';
const TABLE_TO = '2026-12-07';

// 月視圖顯示 2026-11 時的範圍：W45 的星期一到 W49 的下一個星期一。
const NOVEMBER_FROM = '2026-11-02';
const NOVEMBER_TO = '2026-12-07';

function weeksWithEvents(event: string[]): string[] {
	const occurrences = occurrencesInRange([source(ics(event))], TABLE_FROM, TABLE_TO);
	return TABLE_WEEKS.filter((week) => occurrencesForWeek(occurrences, week).length > 0);
}

function linesForWeek(calendars: CalendarSource[], week: string, from: string, to: string): string[] {
	const occurrences = occurrencesInRange(calendars, from, to);
	return occurrencesForWeek(occurrences, week).map(eventLineText);
}

describe('normalizeCalendarAddress', () => {
	const rows: Array<{ stored: string; expected: ReturnType<typeof normalizeCalendarAddress> }> = [
		{
			stored: 'https://calendar.example.com/feed.ics',
			expected: { ok: true, url: 'https://calendar.example.com/feed.ics' },
		},
		{
			stored: 'webcal://calendar.example.com/feed.ics',
			expected: { ok: true, url: 'https://calendar.example.com/feed.ics' },
		},
		{
			stored: '  https://calendar.example.com/feed.ics  ',
			expected: { ok: true, url: 'https://calendar.example.com/feed.ics' },
		},
		{ stored: 'http://calendar.example.com/feed.ics', expected: { ok: false, reason: '連結格式不對' } },
		{ stored: 'calendar.example.com/feed.ics', expected: { ok: false, reason: '連結格式不對' } },
	];

	for (const row of rows) {
		it(`handles ${JSON.stringify(row.stored)}`, () => {
			expect(normalizeCalendarAddress(row.stored)).toEqual(row.expected);
		});
	}

	// 表格最後一列（鑰匙在這台裝置沒有值）由 CalendarStore 回報 `這台裝置找不到連結`，
	// 因為那時根本沒有網址可以正規化。這裡只確認這一層不會冒出那個原因。
	it('leaves the missing-secret reason to the store', () => {
		expect(normalizeCalendarAddress('')).toEqual({ ok: false, reason: '連結格式不對' });
	});
});

describe('parseCalendar', () => {
	it('throws on text that is not an iCalendar object', () => {
		expect(() => parseCalendar('這不是行事曆')).toThrow();
	});

	it('throws when the text is not a VCALENDAR', () => {
		expect(() => parseCalendar('BEGIN:VEVENT\r\nUID:e1\r\nEND:VEVENT')).toThrow();
	});
});

describe('week assignment', () => {
	it('places a timed event with a TZID in the week of its local start', () => {
		expect(
			weeksWithEvents([
				'UID:e1',
				'SUMMARY:讀書會',
				'DTSTART;TZID=Asia/Taipei:20261106T133000',
				'DTEND;TZID=Asia/Taipei:20261106T150000',
			]),
		).toEqual(['2026-W45']);
	});

	it('converts a UTC event to local time', () => {
		expect(
			weeksWithEvents(['UID:e2', 'SUMMARY:讀書會', 'DTSTART:20261106T053000Z', 'DTEND:20261106T070000Z']),
		).toEqual(['2026-W45']);
	});

	it('places a one-day all-day event in the week of its date', () => {
		expect(
			weeksWithEvents([
				'UID:e3',
				'SUMMARY:休假',
				'DTSTART;VALUE=DATE:20261111',
				'DTEND;VALUE=DATE:20261112',
			]),
		).toEqual(['2026-W46']);
	});

	it('spreads an all-day event across the weeks it covers', () => {
		expect(
			weeksWithEvents([
				'UID:e4',
				'SUMMARY:研習營',
				'DTSTART;VALUE=DATE:20261107',
				'DTEND;VALUE=DATE:20261110',
			]),
		).toEqual(['2026-W45', '2026-W46']);
	});

	it('spreads a timed event that crosses midnight into the next week', () => {
		expect(
			weeksWithEvents([
				'UID:e5',
				'SUMMARY:夜間維護',
				'DTSTART;TZID=Asia/Taipei:20261108T220000',
				'DTEND;TZID=Asia/Taipei:20261109T010000',
			]),
		).toEqual(['2026-W45', '2026-W46']);
	});

	it('keeps a Saturday event in the week of that Saturday', () => {
		// 任務的週六規則不套用在行程上，所以 10/31 留在 W44。
		expect(
			weeksWithEvents([
				'UID:e6',
				'SUMMARY:市集',
				'DTSTART;TZID=Asia/Taipei:20261031T100000',
				'DTEND;TZID=Asia/Taipei:20261031T110000',
			]),
		).toEqual(['2026-W44']);
	});

	it('ignores a cancelled event', () => {
		expect(
			weeksWithEvents([
				'UID:e7',
				'SUMMARY:晨會',
				'DTSTART;TZID=Asia/Taipei:20261106T090000',
				'STATUS:CANCELLED',
			]),
		).toEqual([]);
	});

	it('treats an all-day DTEND as exclusive', () => {
		expect(
			weeksWithEvents([
				'UID:e8',
				'SUMMARY:週末營',
				'DTSTART;VALUE=DATE:20261107',
				'DTEND;VALUE=DATE:20261109',
			]),
		).toEqual(['2026-W45']);
	});

	it('leaves an event that ends exactly at Monday 00:00 in the earlier week', () => {
		expect(
			weeksWithEvents([
				'UID:e9',
				'SUMMARY:夜讀',
				'DTSTART;TZID=Asia/Taipei:20261108T220000',
				'DTEND;TZID=Asia/Taipei:20261109T000000',
			]),
		).toEqual(['2026-W45']);
	});

	it('reads a TZID with no definition in the calendar as local time', () => {
		const event = [
			'UID:e10',
			'SUMMARY:視訊會議',
			'DTSTART;TZID=America/New_York:20261106T220000',
		];
		expect(weeksWithEvents(event)).toEqual(['2026-W45']);
		expect(linesForWeek([source(ics(event))], '2026-W45', TABLE_FROM, TABLE_TO)).toEqual([
			'11/6（五）22:00 視訊會議',
		]);
	});

	it('places an override moved into the shown weeks and nothing in its original week', () => {
		const calendars = [
			source(
				ics(
					[
						'UID:e11',
						'SUMMARY:語言課',
						'DTSTART;TZID=Asia/Taipei:20261007T190000',
						'DTEND;TZID=Asia/Taipei:20261007T200000',
						'RRULE:FREQ=WEEKLY;BYDAY=WE',
					],
					[
						'UID:e11',
						'SUMMARY:語言課',
						'RECURRENCE-ID;TZID=Asia/Taipei:20261028T190000',
						'DTSTART;TZID=Asia/Taipei:20261102T190000',
						'DTEND;TZID=Asia/Taipei:20261102T200000',
					],
				),
			),
		];
		expect(linesForWeek(calendars, '2026-W44', TABLE_FROM, TABLE_TO)).toEqual([]);
		expect(linesForWeek(calendars, '2026-W45', TABLE_FROM, TABLE_TO)).toEqual([
			'11/2（一）19:00 語言課',
			'11/4（三）19:00 語言課',
		]);
	});
});

describe('time zones', () => {
	it('converts a TZID defined in the calendar to local time', () => {
		// 固定偏移 +0300 的自訂時區：裝置是 Asia/Taipei，所以 10:00 要讀成 15:00。
		// 用不是本地時區的定義，才看得出真的走了行事曆裡的 VTIMEZONE。
		const text = [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//dashboard//test//EN',
			'BEGIN:VTIMEZONE',
			'TZID:Example/Plus3',
			'BEGIN:STANDARD',
			'DTSTART:19700101T000000',
			'TZOFFSETFROM:+0300',
			'TZOFFSETTO:+0300',
			'TZNAME:P3',
			'END:STANDARD',
			'END:VTIMEZONE',
			'BEGIN:VEVENT',
			'UID:z1',
			'SUMMARY:遠端會議',
			'DTSTART;TZID=Example/Plus3:20261106T100000',
			'DTEND;TZID=Example/Plus3:20261106T110000',
			'END:VEVENT',
			'END:VCALENDAR',
		].join('\r\n');
		const occurrences = occurrencesInRange([source(text)], NOVEMBER_FROM, NOVEMBER_TO);
		expect(occurrences).toHaveLength(1);
		expect(occurrences[0]?.start).toBe('2026-11-06T15:00');
		expect(occurrences[0]?.end).toBe('2026-11-06T16:00');
	});
});

describe('order within a week', () => {
	it('orders a week by date, all-day first, then start time', () => {
		const calendars = [
			source(
				ics(
					[
						'UID:o1',
						'SUMMARY:讀書會',
						'DTSTART;TZID=Asia/Taipei:20261106T133000',
						'DTEND;TZID=Asia/Taipei:20261106T150000',
					],
					['UID:o2', 'SUMMARY:休假', 'DTSTART;VALUE=DATE:20261106', 'DTEND;VALUE=DATE:20261107'],
					[
						'UID:o3',
						'SUMMARY:語言課',
						'DTSTART;TZID=Asia/Taipei:20261104T190000',
						'DTEND;TZID=Asia/Taipei:20261104T200000',
					],
				),
			),
		];
		expect(linesForWeek(calendars, '2026-W45', NOVEMBER_FROM, NOVEMBER_TO)).toEqual([
			'11/4（三）19:00 語言課',
			'11/6（五）休假',
			'11/6（五）13:30 讀書會',
		]);
	});
});

describe('eventLineText', () => {
	function occurrence(overrides: Partial<EventOccurrence>): EventOccurrence {
		return {
			uid: 'u1',
			title: '',
			allDay: false,
			start: '2026-11-06T13:30',
			end: '2026-11-06T15:00',
			calendarIndex: 0,
			calendarName: '工作',
			...overrides,
		};
	}

	const rows: Array<{ name: string; occurrence: EventOccurrence; line: string }> = [
		{
			name: '讀書會, 2026-11-06 13:30–15:00',
			occurrence: occurrence({ title: '讀書會' }),
			line: '11/6（五）13:30 讀書會',
		},
		{
			name: '休假, all day 2026-11-11',
			occurrence: occurrence({
				title: '休假',
				allDay: true,
				start: '2026-11-11',
				end: '2026-11-12',
			}),
			line: '11/11（三）休假',
		},
		{
			name: '研習營, all day from 2026-11-07, exclusive end 2026-11-10',
			occurrence: occurrence({
				title: '研習營',
				allDay: true,
				start: '2026-11-07',
				end: '2026-11-10',
			}),
			line: '11/7（六）–11/9（一）研習營',
		},
		{
			name: '夜間維護, 2026-11-08 22:00 to 2026-11-09 01:00',
			occurrence: occurrence({
				title: '夜間維護',
				start: '2026-11-08T22:00',
				end: '2026-11-09T01:00',
			}),
			line: '11/8（日）22:00–11/9（一）01:00 夜間維護',
		},
		{
			name: 'no title, 2026-11-06 09:05',
			occurrence: occurrence({ start: '2026-11-06T09:05', end: '2026-11-06T09:05' }),
			line: '11/6（五）09:05 （沒有標題）',
		},
	];

	for (const row of rows) {
		it(`writes ${row.name}`, () => {
			expect(eventLineText(row.occurrence)).toBe(row.line);
		});
	}
});

describe('A weekly event with an exception and an excluded date', () => {
	it('shows the expanded, excluded and moved occurrences in the right weeks', () => {
		const calendars = [
			source(
				ics(
					[
						'UID:w1',
						'SUMMARY:語言課',
						'DTSTART;TZID=Asia/Taipei:20261104T190000',
						'DTEND;TZID=Asia/Taipei:20261104T200000',
						'RRULE:FREQ=WEEKLY;BYDAY=WE',
						'EXDATE;TZID=Asia/Taipei:20261118T190000',
					],
					[
						'UID:w1',
						'SUMMARY:語言課',
						'RECURRENCE-ID;TZID=Asia/Taipei:20261125T190000',
						'DTSTART;TZID=Asia/Taipei:20261126T200000',
						'DTEND;TZID=Asia/Taipei:20261126T210000',
					],
				),
			),
		];
		const lines = (week: string): string[] => linesForWeek(calendars, week, NOVEMBER_FROM, NOVEMBER_TO);
		expect(lines('2026-W45')).toEqual(['11/4（三）19:00 語言課']);
		expect(lines('2026-W46')).toEqual(['11/11（三）19:00 語言課']);
		expect(lines('2026-W47')).toEqual([]);
		expect(lines('2026-W48')).toEqual(['11/26（四）20:00 語言課']);
		expect(lines('2026-W49')).toEqual(['12/2（三）19:00 語言課']);
	});
});

describe('occurrencesInRange', () => {
	it('reaches the shown month from a daily event that started in 2016', () => {
		const calendars = [
			source(
				ics([
					'UID:d1',
					'SUMMARY:伸展',
					'DTSTART;TZID=Asia/Taipei:20160101T080000',
					'DTEND;TZID=Asia/Taipei:20160101T081500',
					'RRULE:FREQ=DAILY',
				]),
			),
		];
		const occurrences = occurrencesInRange(calendars, NOVEMBER_FROM, NOVEMBER_TO);
		for (const week of ['2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49']) {
			expect(occurrencesForWeek(occurrences, week).length).toBeGreaterThan(0);
		}
	});

	it('stops a FREQ=SECONDLY event within the cap instead of hanging', () => {
		const calendars = [
			source(
				ics([
					'UID:s1',
					'SUMMARY:壞掉的規則',
					'DTSTART;TZID=Asia/Taipei:20260101T000000',
					'DTEND;TZID=Asia/Taipei:20260101T000100',
					'RRULE:FREQ=SECONDLY',
				]),
			),
		];
		const started = Date.now();
		// 100,000 次只走到 2026-01-02，離顯示範圍很遠，所以上限一到就停。
		expect(occurrencesInRange(calendars, NOVEMBER_FROM, NOVEMBER_TO)).toEqual([]);
		expect(Date.now() - started).toBeLessThan(5000);
	});

	it('shows the same UID and start from two calendars once', () => {
		const event = [
			'UID:shared',
			'SUMMARY:讀書會',
			'DTSTART;TZID=Asia/Taipei:20261106T133000',
			'DTEND;TZID=Asia/Taipei:20261106T150000',
		];
		const calendars = [source(ics(event), 0, '工作'), source(ics(event), 1, '家庭')];
		const occurrences = occurrencesInRange(calendars, NOVEMBER_FROM, NOVEMBER_TO);
		expect(occurrences).toHaveLength(1);
		expect(occurrences[0]?.calendarName).toBe('工作');
	});
});
