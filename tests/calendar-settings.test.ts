import { describe, expect, it } from 'vitest';
import { isCalendarAddress } from '../src/core/calendar';
import { calendarColor, calendarLinkPlaceholder, defaultCalendarColor, generateCalendarSecretId } from '../src/core/settings';

describe('calendar colors', () => {
	it.each([
		[1, '#4a7fd4'], [2, '#2f9e6e'], [3, '#e08a2c'], [4, '#8e5bd6'],
		[5, '#1b9aaa'], [6, '#d6559e'], [7, '#4a7fd4'], [8, '#2f9e6e'],
	])('uses the default color %s at position %s', (position, color) => {
		expect(defaultCalendarColor(position)).toBe(color);
	});

	it('uses a picked color instead of the position default', () => {
		expect(calendarColor({ name: '工作', secretId: 'a', color: '#8e5bd6' }, 1)).toBe('#8e5bd6');
	});
});

describe('calendar link settings helpers', () => {
	it('generates eight lowercase letters and digits using the injected random source', () => {
		const values = [0, 25 / 36, 26 / 36, 35 / 36, 1 / 36, 27 / 36, 2 / 36, 28 / 36];
		expect(generateCalendarSecretId([], () => values.shift()!)).toBe('project-dashboard-calendar-az09b1c2');
	});

	it('retries when another calendar already uses the generated ID', () => {
		let calls = 0;
		const used = ['project-dashboard-calendar-aaaaaaaa', 'project-dashboard-calendar-bbbbbbbb'];
		expect(generateCalendarSecretId(used, () => Math.floor(calls++ / 8) / 36))
			.toBe('project-dashboard-calendar-cccccccc');
		expect(used).toEqual(['project-dashboard-calendar-aaaaaaaa', 'project-dashboard-calendar-bbbbbbbb']);
	});

	it.each([
		['https://calendar.example.com/feed.ics', true],
		['webcal://calendar.example.com/feed.ics', true],
		['  https://calendar.example.com/feed.ics  ', true],
		['  webcal://calendar.example.com/feed.ics  ', true],
		['http://calendar.example.com/feed.ics', false],
		['calendar.example.com/feed.ics', false],
		['HTTPS://calendar.example.com/feed.ics', false],
		['', false],
		['   ', false],
	])('checks %j against the existing address rules', (raw, expected) => {
		expect(isCalendarAddress(raw)).toBe(expected);
	});

	it.each([
		['', null, 'Paste the calendar link here'],
		['calendar-a', 'https://calendar.example.com/feed.ics', 'Link saved. Paste a new link to change it.'],
		['calendar-a', null, 'This computer has no link yet. Paste it here.'],
		['calendar-a', '', 'This computer has no link yet. Paste it here.'],
	])('selects the placeholder for ID %j and its local value', (id, value, expected) => {
		expect(calendarLinkPlaceholder(id, value)).toBe(expected);
	});
});
