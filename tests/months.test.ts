import { describe, expect, it } from 'vitest';
import { monthViewCells } from '../src/core/cells';
import {
	monthCellLines,
	monthCellTaskLines,
	monthOfDate,
	monthOfWeek,
	monthTitle,
	shiftMonth,
	unscheduledSummary,
	weeksOfMonth,
} from '../src/core/months';
import type { ProjectRecord } from '../src/core/scan';
import { parseTaskLines } from '../src/core/task-lines';

const SAT_ON = { saturdayCountsAsNextWeek: true };

function project(text: string, overrides: Partial<ProjectRecord> = {}): ProjectRecord {
	return {
		name: 'P-測試專案',
		category: 'other',
		color: '#6B7280',
		status: 'active',
		start: '2026-01-01',
		end: '2026-12-31',
		promised_end: null,
		overflow_end: null,
		task_dates: [],
		tasks: [],
		occupied_weeks: [],
		settled_weeks: [],
		warnings: [],
		path: '/tmp/P-測試專案.md',
		task_lines: parseTaskLines(text),
		...overrides,
	};
}

describe('weeksOfMonth', () => {
	// Example: weeks of a month（dashboard-month-view）：一列一個測試。
	it.each([
		[2025, 12, ['2025-W49', '2025-W50', '2025-W51', '2025-W52']],
		[2026, 1, ['2026-W01', '2026-W02', '2026-W03', '2026-W04', '2026-W05']],
		[2026, 3, ['2026-W10', '2026-W11', '2026-W12', '2026-W13', '2026-W14']],
		[2026, 9, ['2026-W37', '2026-W38', '2026-W39', '2026-W40']],
		[2026, 10, ['2026-W41', '2026-W42', '2026-W43', '2026-W44']],
		[2026, 11, ['2026-W45', '2026-W46', '2026-W47', '2026-W48', '2026-W49']],
		[2026, 12, ['2026-W50', '2026-W51', '2026-W52', '2026-W53']],
		[2027, 1, ['2027-W01', '2027-W02', '2027-W03', '2027-W04']],
	])('%d-%d lists its weeks in order', (year, month, labels) => {
		expect(weeksOfMonth(year, month).map((w) => w.label)).toEqual(labels);
	});

	it('gives the Monday–Sunday range of a week whose Monday is in the previous year', () => {
		const w = weeksOfMonth(2026, 1)[0]!;
		expect(w.label).toBe('2026-W01');
		expect(w.start.toISOString().slice(0, 10)).toBe('2025-12-29');
		expect(w.end.toISOString().slice(0, 10)).toBe('2026-01-05');
		expect(w.week).toBe(1);
		expect(w.month).toBe(0);
	});
});

describe('monthOfWeek', () => {
	it("uses the month of the week's Monday", () => {
		expect(monthOfWeek('2026-W40')).toEqual({ year: 2026, month: 9 });
		expect(monthOfWeek('2026-W41')).toEqual({ year: 2026, month: 10 });
		expect(monthOfWeek('2026-W49')).toEqual({ year: 2026, month: 11 });
	});

	it('always puts W01 in January, even when its Monday is in December', () => {
		expect(monthOfWeek('2026-W01')).toEqual({ year: 2026, month: 1 });
		expect(monthOfWeek('2027-W01')).toEqual({ year: 2027, month: 1 });
	});
});

describe('monthTitle', () => {
	it.each([
		[2026, 10, '2026 年 10 月（W41–W44）'],
		[2026, 11, '2026 年 11 月（W45–W49）'],
		[2027, 1, '2027 年 1 月（W1–W4）'],
	])('%d-%d reads %s', (year, month, title) => {
		expect(monthTitle(year, month, weeksOfMonth(year, month))).toBe(title);
	});
});

describe('shiftMonth', () => {
	it('crosses the year boundary forwards', () => {
		expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
	});

	it('crosses the year boundary backwards', () => {
		expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
	});

	it('moves within a year', () => {
		expect(shiftMonth({ year: 2026, month: 10 }, 1)).toEqual({ year: 2026, month: 11 });
	});
});

describe('monthOfDate', () => {
	it('gives 2026-10 for 2026-10-30', () => {
		expect(monthOfDate('2026-10-30')).toEqual({ year: 2026, month: 10 });
	});

	// 2025-12-30 落在 2026-W01，而 W01 永遠算一月，所以月視圖顯示 2026 年 1 月。
	it('gives 2026-01 for a date in the W01 that starts in December', () => {
		expect(monthOfDate('2025-12-30')).toEqual({ year: 2026, month: 1 });
	});
});

describe('monthCellLines', () => {
	// Example: line state（dashboard-month-view）：一列一個測試。
	it.each([
		['- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26', '2026-W44', '2026-10-30', '租借場地', 'done'],
		['- [ ] 確認拍攝服裝 📅 2026-10-30', '2026-W44', '2026-10-30', '確認拍攝服裝', 'open'],
		['- [ ] 寄出合約 📅 2026-10-21', '2026-W43', '2026-10-30', '寄出合約', 'overdue'],
		['- [ ] 寄出合約 📅 2026-10-21', '2026-W43', '2026-10-25', '寄出合約', 'open'],
		['會議紀錄 📅 2026-10-21', '2026-W43', '2026-10-30', '會議紀錄', 'overdue'],
	])('%s in %s on %s is %s', (raw, weekLabel, today, text, state) => {
		expect(monthCellLines(project(raw), weekLabel, SAT_ON, today)).toEqual([{ line: 0, text, state }]);
	});

	// Scenario: Line states in one cell。
	it("lists one cell's lines in the week popover's order with their states", () => {
		const p = project(
			['- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26', '- [ ] 確認拍攝服裝 📅 2026-10-30', '- [ ] 寄出合約 📅 2026-10-21'].join('\n'),
		);
		expect(monthCellLines(p, '2026-W44', SAT_ON, '2026-10-30')).toEqual([
			{ line: 0, text: '租借場地', state: 'done' },
			{ line: 1, text: '確認拍攝服裝', state: 'open' },
		]);
		expect(monthCellLines(p, '2026-W43', SAT_ON, '2026-10-30')).toEqual([
			{ line: 2, text: '寄出合約', state: 'overdue' },
		]);
	});

	it('shows no line for a week no task maps to', () => {
		const p = project('- [ ] 確認拍攝服裝 📅 2026-10-30');
		expect(monthCellLines(p, '2026-W42', SAT_ON, '2026-10-30')).toEqual([]);
	});
});

describe('monthCellTaskLines', () => {
	// Scenario: A blank week shows no text。
	it('shows no text in a blank cell even when a task maps to its week', () => {
		const p = project('- [ ] 前置作業 📅 2026-10-28', {
			start: '2026-11-02',
			end: '2026-11-30',
			task_dates: ['2026-10-28'],
			occupied_weeks: ['2026-W44'],
		});
		const weeks = weeksOfMonth(2026, 10);
		const cells = monthViewCells(p, weeks, SAT_ON);
		const w44 = weeks.findIndex((w) => w.label === '2026-W44');

		expect(cells[w44]!.kind).toBe('blank');
		// 任務真的對應到那一週，是 blank 這條規則讓格子空著。
		expect(monthCellLines(p, '2026-W44', SAT_ON, '2026-10-30')).toHaveLength(1);
		expect(monthCellTaskLines(p, '2026-W44', cells[w44]!.kind, SAT_ON, '2026-10-30')).toEqual([]);
	});

	it('lists the lines of a cell that is not blank', () => {
		const p = project('- [ ] 確認拍攝服裝 📅 2026-10-30', {
			start: '2026-10-01',
			end: '2026-11-30',
			task_dates: ['2026-10-30'],
			occupied_weeks: ['2026-W44'],
		});
		expect(monthCellTaskLines(p, '2026-W44', 'solid', SAT_ON, '2026-10-30')).toEqual([
			{ line: 0, text: '確認拍攝服裝', state: 'open' },
		]);
	});
});

describe('unscheduledSummary', () => {
	// Scenario: Count and tooltip。
	it('counts the unscheduled tasks and lists them one per line', () => {
		const p = project(['- [ ] 製作學習日曆', '- [ ] 整理名單'].join('\n'));
		expect(unscheduledSummary(p)).toEqual({ count: 2, tooltip: '製作學習日曆\n整理名單' });
	});

	it('reports 0 with an empty tooltip when every task has a date', () => {
		const p = project('- [ ] 確認拍攝服裝 📅 2026-10-30');
		expect(unscheduledSummary(p)).toEqual({ count: 0, tooltip: '' });
	});
});
