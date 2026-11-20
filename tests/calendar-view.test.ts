import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { CalendarStore } from '../src/calendar-store';
import type { EventOccurrence } from '../src/core/calendar';
import { weeksOfMonth } from '../src/core/months';
import { defaultSettings } from '../src/core/settings';
import { MonthView, type CalendarRowData } from '../src/month-view';
import { ProjectDashboardView } from '../src/view';
import type ProjectDashboardPlugin from '../src/main';
import type { VaultSource } from '../src/vault-source';
import { SettingsElement } from './stubs/obsidian';

function descendants(element: SettingsElement, cls: string): SettingsElement[] {
	return [
		...(element.classes.has(cls) ? [element] : []),
		...element.children.flatMap((child) => descendants(child, cls)),
	];
}

describe('calendar labels in the dashboard', () => {
	it('redraws labels from current settings while reusing expanded occurrences', async () => {
		const settings = defaultSettings();
		settings.calendars = [{ name: '工作', secretId: 'work-calendar', color: '' }];
		const request = vi.fn(() => Promise.resolve({
			status: 200,
			text: [
				'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:work-1',
				'DTSTART:20261106T133000', 'DTEND:20261106T150000', 'SUMMARY:讀書會',
				'END:VEVENT', 'END:VCALENDAR',
			].join('\r\n'),
		}));
		const calendars = new CalendarStore({
			request,
			getSecret: () => 'https://calendar.example.com/feed.ics',
			now: () => new Date(2026, 10, 6, 15, 20),
			calendars: () => settings.calendars,
		});
		await calendars.refresh();
		const view = new ProjectDashboardView(
			{} as WorkspaceLeaf,
			{} as VaultSource,
			{ store: { data: { settings } }, calendars } as unknown as ProjectDashboardPlugin,
		);
		// 直接測資料與重繪邊界，不啟動會註冊 vault 監聽器的完整工作區生命週期。
		const fixture = view as unknown as {
			monthWeeks: ReturnType<typeof weeksOfMonth>;
			calendarRowData(): CalendarRowData;
			calendarCache: { occurrences: EventOccurrence[] };
		};
		fixture.monthWeeks = weeksOfMonth(2026, 11);
		const first = fixture.calendarRowData();
		const expanded = fixture.calendarCache.occurrences;
		expect(first.lines('2026-W45')).toEqual([
			{ text: '11/6（五）13:30 讀書會', calendarName: '工作', calendarColor: '#4a7fd4' },
		]);
		settings.calendars = [{ name: '公司', secretId: 'work-calendar', color: '#8e5bd6' }];
		await calendars.refreshIfCalendarsChanged();
		const updated = fixture.calendarRowData();
		expect(updated.lines('2026-W45')).toEqual([
			{ text: '11/6（五）13:30 讀書會', calendarName: '公司', calendarColor: '#8e5bd6' },
		]);
		expect(fixture.calendarCache.occurrences).toBe(expanded);
		expect(request).toHaveBeenCalledOnce();

		const container = new SettingsElement();
		new MonthView({
			projects: () => [],
			weeks: () => fixture.monthWeeks,
			settings: () => settings,
			today: () => '2026-11-06',
			categoryOrder: () => [],
			calendarRow: () => updated,
		}).render(container as unknown as HTMLElement);
		const label = descendants(container, 'gc-label')[0]!;
		expect(label.textContent).toBe('公司');
		expect(label.cssProps).toEqual({ '--pd-calendar-color': '#8e5bd6' });
		const line = descendants(container, 'gc-line')[0]!;
		expect(line.children.map((child) => child.textContent)).toEqual(['公司', '11/6（五）13:30 讀書會']);
		expect(line.attributes.has('title')).toBe(false);
		expect(label.attributes.has('title')).toBe(false);
		expect(descendants(container, 'general-cell')[0]!.classes.has('today-col')).toBe(true);
	});
});
