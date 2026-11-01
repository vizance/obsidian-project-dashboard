import { describe, expect, it } from 'vitest';
import { calendarStatusLine, monthEventRange, type CalendarFetchStatus } from '../src/core/calendar-row';

function status(patch: Partial<CalendarFetchStatus> = {}): CalendarFetchStatus {
	return { running: false, started: true, finishedAt: '15:20', failures: [], ...patch };
}

describe('calendarStatusLine', () => {
	it('is empty before the first fetch of this session has started', () => {
		expect(calendarStatusLine(status({ started: false, finishedAt: null }))).toEqual({ text: '', tooltip: '' });
	});

	it('reads 讀取中… while a fetch is running', () => {
		expect(calendarStatusLine(status({ running: true, finishedAt: null }))).toEqual({
			text: '讀取中…',
			tooltip: '',
		});
	});

	// 規格的情境「The General row lists a week's events」：讀取在 15:20 結束。
	it('reads 更新於 HH:MM after a fetch with no failure', () => {
		expect(calendarStatusLine(status())).toEqual({ text: '更新於 15:20', tooltip: '' });
	});

	// 規格的情境「A failed calendar is reported by name」：沒取名的第二個行事曆。
	it('counts the failed calendars and lists them in the tooltip', () => {
		expect(calendarStatusLine(status({
			finishedAt: '09:00',
			failures: [{ displayName: '行事曆 2', reason: '連結格式不對' }],
		}))).toEqual({
			text: '更新於 09:00・⚠ 1 個行事曆讀不到',
			tooltip: '行事曆 2：連結格式不對',
		});
	});

	it('lists one failed calendar per line', () => {
		expect(calendarStatusLine(status({
			finishedAt: '09:00',
			failures: [
				{ displayName: '工作', reason: '讀取失敗（HTTP 404）' },
				{ displayName: '行事曆 2', reason: '連結格式不對' },
			],
		}))).toEqual({
			text: '更新於 09:00・⚠ 2 個行事曆讀不到',
			tooltip: '工作：讀取失敗（HTTP 404）\n行事曆 2：連結格式不對',
		});
	});

	// 讀取進行中就是進行中，前一次的結束時間不會蓋過 `讀取中…`。
	it('prefers 讀取中… over the last finish time', () => {
		expect(calendarStatusLine(status({ running: true })).text).toBe('讀取中…');
	});
});

describe('monthEventRange', () => {
	// 2026-11 的五週：W45 的週一 11/2 到 W49 的下一個週一 12/7。
	it('runs from the first week Monday to the Monday after the last week', () => {
		expect(monthEventRange(['2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49'])).toEqual({
			from: '2026-11-02',
			to: '2026-12-07',
		});
	});

	it('crosses the year boundary', () => {
		expect(monthEventRange(['2026-W53', '2027-W01'])).toEqual({ from: '2026-12-28', to: '2027-01-11' });
	});

	it('has no range without weeks', () => {
		expect(monthEventRange([])).toBeNull();
	});
});
