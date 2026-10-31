import { describe, expect, it } from 'vitest';
import { type Cell, monthViewCells, perWeekCells, sortProjects, spanWeekOffset, timelineCells } from '../src/core/cells';
import { monthCellTaskLines, weeksOfMonth } from '../src/core/months';
import { scanProjectNote, type ProjectRecord } from '../src/core/scan';
import { defaultSettings } from '../src/core/settings';
import { buildWeeks, type WeekInfo } from '../src/core/weeks';

const weeks: WeekInfo[] = buildWeeks(2026);

// 這些格子測試都用「週六算下一週」開啟的設定，與維護者目前的值相同；
// 週六規則本身的開／關差異由 task 2.4 的測試負責。
const SAT_ON = { saturdayCountsAsNextWeek: true };
const SAT_OFF = { saturdayCountsAsNextWeek: false };

function weekIndex(label: string): number {
	const idx = weeks.findIndex((w) => w.label === label);
	if (idx === -1) throw new Error(`no such week: ${label}`);
	return idx;
}

function project(overrides: Partial<ProjectRecord>): ProjectRecord {
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
		task_lines: [],
		...overrides,
	};
}

// 走真正的掃描器，overflow_end、occupied_weeks、task_lines 才是算出來的，不是手寫的。
function scanned(filename: string, lines: string[], frontmatter: Record<string, string>): ProjectRecord {
	const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`);
	const text = ['---', ...fm, '---', '', ...lines].join('\n');
	const record = scanProjectNote(
		{ filename, text, path: `/tmp/${filename}` },
		{ overrides: {}, today: '2026-10-30', settings: { ...defaultSettings(), saturdayCountsAsNextWeek: true } },
	);
	if (!record) throw new Error(`note was skipped: ${filename}`);
	return record;
}

// 月視圖把年視圖的一條 span-dashed 攤成一格一格的 dashed，比對兩邊時年視圖也要攤開。
function expandSpanDashed(cells: Cell[]): Cell[] {
	const out = cells.slice();
	for (let i = 0; i < out.length; i++) {
		const cell = out[i]!;
		if (cell.kind !== 'span-dashed') continue;
		const last = Math.min(out.length - 1, i + cell.spanWeeks - 1);
		for (let j = i; j <= last; j++) out[j] = { ...cell, kind: 'dashed', spanWeeks: 1 };
		i = last;
	}
	return out;
}

describe('perWeekCells — per-week cell kinds', () => {
	it('solid: active, week in [start, end], has an incomplete task that week (W44)', () => {
		const p = project({ task_dates: ['2026-10-26'], occupied_weeks: ['2026-W44'], settled_weeks: [] });
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W44')]!.kind).toBe('solid');
	});

	it('settled: active, week in [start, end], all tasks that week complete (W30)', () => {
		const p = project({ task_dates: ['2026-07-20'], occupied_weeks: ['2026-W30'], settled_weeks: ['2026-W30'] });
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W30')]!.kind).toBe('settled');
	});

	it('dashed: active, week in [start, end], no task that week (W40)', () => {
		const p = project({ task_dates: ['2026-09-21'], occupied_weeks: [], settled_weeks: [] });
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W40')]!.kind).toBe('dashed');
	});

	it('overflow: active, week after end and up to overflow_end, has a task (W50)', () => {
		const p = project({
			end: '2026-10-01',
			overflow_end: '2026-12-31',
			task_dates: ['2026-12-10'],
			occupied_weeks: ['2026-W50'],
			settled_weeks: [],
		});
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W50')]!.kind).toBe('overflow');
	});

	it('span-dashed: active, no task dates at all, first week of [start, end]', () => {
		const p = project({ start: '2026-02-02', end: '2026-02-28', task_dates: [] });
		const cells = perWeekCells(p, weeks, SAT_ON);
		const startIdx = weeks.findIndex((w) => new Date('2026-02-28T00:00:00Z') >= w.start && new Date('2026-02-02T00:00:00Z') < w.end);
		expect(cells[startIdx]!.kind).toBe('span-dashed');
	});

	it('blank: done, week in [start, end], no task that week (W40)', () => {
		const p = project({ status: 'done', occupied_weeks: [], settled_weeks: [] });
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W40')]!.kind).toBe('blank');
		expect(cells[weekIndex('2026-W40')]!.closed).toBe(true);
	});

	it('overflow wins over settled for a week past end that is marked settled', () => {
		const p = project({
			end: '2026-10-01',
			overflow_end: '2026-12-31',
			task_dates: ['2026-12-10'],
			occupied_weeks: ['2026-W50'],
			settled_weeks: ['2026-W50'],
		});
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W50')]!.kind).toBe('overflow');
	});

	it('produces an exact tooltip string for a Saturday-bumped task', () => {
		const p = project({
			task_dates: ['2026-10-31'],
			occupied_weeks: ['2026-W45'],
			settled_weeks: [],
			tasks: [{ date: '2026-10-31', kind: 'planned', text: '盤點', done: false }],
		});
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W45')]!.tooltip).toBe(
			'P-測試專案\n2026-W45\n· 盤點（2026-10-31 預計 (Sat → 本週)）',
		);
	});

	// Scenario: Tooltip annotates bumped Saturday dates（dashboard-gantt-rendering）。
	it('annotates a bumped Saturday date in the next week when the setting is on', () => {
		const p = project({
			task_dates: ['2026-02-21'],
			occupied_weeks: ['2026-W09'],
			settled_weeks: [],
			tasks: [{ date: '2026-02-21', kind: 'planned', text: '盤點', done: false }],
		});
		const cells = perWeekCells(p, weeks, SAT_ON);
		const tooltip = cells[weekIndex('2026-W09')]!.tooltip;
		expect(tooltip).toContain('2026-02-21');
		expect(tooltip).toContain('(Sat → 本週)');
		expect(cells[weekIndex('2026-W08')]!.kind).toBe('dashed');
	});

	// Scenario: Saturday dates carry no marker when the setting is off。
	it('keeps a Saturday date in its own week without a marker when the setting is off', () => {
		const p = project({
			task_dates: ['2026-02-21'],
			occupied_weeks: ['2026-W08'],
			settled_weeks: [],
			tasks: [{ date: '2026-02-21', kind: 'planned', text: '盤點', done: false }],
		});
		const cells = perWeekCells(p, weeks, SAT_OFF);
		const tooltip = cells[weekIndex('2026-W08')]!.tooltip;
		expect(tooltip).toBe('P-測試專案\n2026-W08\n· 盤點（2026-02-21 預計）');
		expect(tooltip).not.toContain('Sat');
		expect(cells[weekIndex('2026-W09')]!.kind).toBe('dashed');
	});
});

describe('monthViewCells', () => {
	it('splits the year view’s span-dashed bar into one dashed cell per week', () => {
		const p = project({ start: '2026-10-05', end: '2026-11-01', task_dates: [] });
		const yearCells = perWeekCells(p, weeks, SAT_ON);
		expect(yearCells[weekIndex('2026-W41')]!.kind).toBe('span-dashed');
		expect(yearCells[weekIndex('2026-W41')]!.spanWeeks).toBe(4);

		const monthWeeks = weeksOfMonth(2026, 10);
		const cells = monthViewCells(p, monthWeeks, SAT_ON);
		expect(monthWeeks.map((w) => w.label)).toEqual(['2026-W41', '2026-W42', '2026-W43', '2026-W44']);
		expect(cells.map((c) => c.kind)).toEqual(['dashed', 'dashed', 'dashed', 'dashed']);
		expect(cells.map((c) => c.spanWeeks)).toEqual([1, 1, 1, 1]);
	});

	it('gives a week with tasks the same kind as the year view’s same week', () => {
		const p = project({
			task_dates: ['2026-10-26'],
			occupied_weeks: ['2026-W44'],
			settled_weeks: [],
		});
		const monthWeeks = weeksOfMonth(2026, 10);
		const cells = monthViewCells(p, monthWeeks, SAT_ON);
		const yearCells = perWeekCells(p, weeks, SAT_ON);
		for (const [i, w] of monthWeeks.entries()) {
			expect(cells[i]!.kind).toBe(yearCells[weekIndex(w.label)]!.kind);
		}
		expect(cells[3]!.kind).toBe('solid');
		expect(cells[2]!.kind).toBe('dashed');
	});

	// 月視圖可以顯示今年以外的月份，格子不能依賴年視圖的 this.weeks。
	it('works for a month outside the rendered year (2027-01)', () => {
		const p = project({
			start: '2027-01-04',
			end: '2027-01-31',
			task_dates: ['2027-01-05'],
			occupied_weeks: ['2027-W01'],
			settled_weeks: [],
		});
		const monthWeeks = weeksOfMonth(2027, 1);
		const cells = monthViewCells(p, monthWeeks, SAT_ON);
		expect(monthWeeks.map((w) => w.label)).toEqual(['2027-W01', '2027-W02', '2027-W03', '2027-W04']);
		expect(cells.map((c) => c.kind)).toEqual(['solid', 'dashed', 'dashed', 'dashed']);
	});

	// Scenario: Overflow weeks after the expected end（dashboard-month-view）。
	// 整個專案都在九月之前，但超出預計結束日期的那一週在年視圖是 overflow，月視圖也要是。
	it('keeps an overflow week after the expected end when the whole project is before the month', () => {
		const p = scanned('🚧 P-範例專案 A.md', ['- [ ] 補交成果報告 📅 2026-09-09'], {
			開始日期: '2026-08-03',
			預計結束日期: '2026-08-30',
		});
		expect(p.overflow_end).toBe('2026-09-09');

		const monthWeeks = weeksOfMonth(2026, 9);
		const cells = monthViewCells(p, monthWeeks, SAT_ON);
		const w37 = monthWeeks.findIndex((w) => w.label === '2026-W37');
		expect(w37).not.toBe(-1);
		expect(cells[w37]!.kind).toBe('overflow');
		expect(monthCellTaskLines(p, '2026-W37', cells[w37]!.kind, SAT_ON, '2026-10-30').map((l) => l.text)).toEqual([
			'補交成果報告',
		]);
	});

	// 每一格的 kind 都必須等於年視圖同一週的 kind，不管顯示的是哪個月。
	it('matches the year view’s kind for every week of every 2026 month', () => {
		const cases: Array<[string, ProjectRecord]> = [
			['no task dates', scanned('🚧 P-範例專案 B.md', [], { 開始日期: '2026-03-02', 預計結束日期: '2026-04-10' })],
			[
				'task before start',
				scanned('🚧 P-範例專案 C.md', ['- [ ] 前置作業 📅 2026-10-28', '- [ ] 開工 📅 2026-11-04'], {
					開始日期: '2026-11-02',
					預計結束日期: '2026-11-29',
				}),
			],
			[
				'overflow into the next month',
				scanned('🚧 P-範例專案 D.md', ['- [ ] 拍攝 📅 2026-08-12', '- [ ] 補交成果報告 📅 2026-09-09'], {
					開始日期: '2026-08-03',
					預計結束日期: '2026-08-30',
				}),
			],
			[
				'closed project',
				scanned('✅ P-範例專案 E.md', ['- [x] 結案 📅 2026-06-16 ✅ 2026-06-15'], {
					開始日期: '2026-05-04',
					預計結束日期: '2026-06-28',
				}),
			],
		];

		for (const [label, p] of cases) {
			const yearCells = expandSpanDashed(perWeekCells(p, weeks, SAT_ON));
			for (let month = 1; month <= 12; month++) {
				const monthWeeks = weeksOfMonth(2026, month);
				const cells = monthViewCells(p, monthWeeks, SAT_ON);
				expect(cells).toHaveLength(monthWeeks.length);
				for (const [i, w] of monthWeeks.entries()) {
					expect(`${label} ${w.label} ${cells[i]!.kind}`).toBe(
						`${label} ${w.label} ${yearCells[weekIndex(w.label)]!.kind}`,
					);
				}
			}
		}
	});
});

describe('timelineCells', () => {
	it('spans from start to max(end, overflow_end)', () => {
		const p = project({ start: '2026-02-02', end: '2026-06-01', overflow_end: '2026-09-15' });
		const cells = timelineCells(p, weeks);
		const startIdx = weeks.findIndex((w) => new Date('2026-06-01T00:00:00Z') >= w.start && new Date('2026-02-02T00:00:00Z') < w.end);
		let rightIdx = -1;
		for (let i = weeks.length - 1; i >= 0; i--) {
			if (weeks[i]!.start < new Date('2026-09-15T00:00:00Z')) {
				rightIdx = i;
				break;
			}
		}
		expect(cells[startIdx]!.kind).toBe('span-solid');
		expect(cells[startIdx]!.spanWeeks).toBe(rightIdx - startIdx + 1);
		expect(cells[startIdx]!.tooltip).toBe('P-測試專案\n2026-02-02 ~ 2026-09-15');
	});
});

describe('spanWeekOffset', () => {
	it('maps a click inside a 10-week, 400 px span to the third week', () => {
		expect(spanWeekOffset(95, 400, 10)).toBe(2);
	});

	it('clamps a click left of the span to the first week', () => {
		expect(spanWeekOffset(-20, 400, 10)).toBe(0);
	});

	it('clamps a click past the span to the last week', () => {
		expect(spanWeekOffset(500, 400, 10)).toBe(9);
	});
});

describe('sortProjects', () => {
	it('puts the pinned category first, then category order, then start ascending', () => {
		const a = project({ name: 'A', category: 'life', start: '2026-03-01' });
		const b = project({ name: 'B', category: 'corporate', start: '2026-01-01' });
		const c = project({ name: 'C', category: 'life', start: '2026-01-15' });
		const d = project({ name: 'D', category: 'corporate', start: '2026-02-01' });

		const order = ['corporate', 'online_course', 'coaching', 'publishing', 'sponsorship', 'life', 'other'];
		const sorted = sortProjects([a, b, c, d], order, 'life');

		expect(sorted.map((p) => p.name)).toEqual(['C', 'A', 'B', 'D']);
	});
});
