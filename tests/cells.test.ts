import { describe, expect, it } from 'vitest';
import { type Cell, monthViewCells, perWeekCells, sortProjects, spanWeekOffset, timelineCells, visibleProjects, weekCellKind, yearViewCells } from '../src/core/cells';
import { monthCellTaskLines, weeksOfMonth } from '../src/core/months';
import { scanProjectNote, type ProjectRecord } from '../src/core/scan';
import { taskLinesForWeek } from '../src/core/task-lines';
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
	it('uses the week containing end when overflow_end has no occupied week', () => {
		const p = project({ start: '2026-02-02', end: '2026-06-01', overflow_end: '2026-09-15' });
		const cells = timelineCells(p, weeks);
		expect(cells[weekIndex('2026-W06')]!.kind).toBe('span-solid');
		expect(cells[weekIndex('2026-W06')]!.spanWeeks).toBe(18);
		expect(cells[weekIndex('2026-W06')]!.tooltip).toBe('P-測試專案\n2026-02-02 ~ 2026-09-15');
		expect(cells.filter((c) => c.kind !== 'blank')).toHaveLength(1);
	});
});

describe('yearViewCells', () => {
	const nextYear = buildWeeks(2027);
	const modes = ['per-week', 'timeline'] as const;

	it('renders all 52 ISO weeks of 2027', () => {
		expect(nextYear).toHaveLength(52);
		expect(nextYear[0]!.label).toBe('2027-W01');
		expect(nextYear[51]!.label).toBe('2027-W52');
	});

	const overflow = scanned('🚧 P-範例專案 F.md', ['- [ ] 結案報告 📅 2027-01-13'], {
		開始日期: '2026-10-01',
		預計結束日期: '2026-12-20',
	});

	it('keeps only the occupied overflow week when the expected end was last year', () => {
		expect(overflow.overflow_end).toBe('2027-01-13');
		const cells = yearViewCells(overflow, nextYear, SAT_ON, 'per-week');
		expect(cells).toHaveLength(52);
		expect(cells[0]!.kind).toBe('blank');
		expect(cells[1]!.kind).toBe('overflow');
		expect(cells[1]!.tooltip).toContain('2027-W02');
		expect(cells.slice(2).every((c) => c.kind === 'blank')).toBe(true);
	});

	it('clips the overflow timeline to W1–W2 of the shown year', () => {
		const cells = yearViewCells(overflow, nextYear, SAT_ON, 'timeline');
		expect(cells[0]).toEqual({
			kind: 'span-solid', spanWeeks: 2, closed: false,
			tooltip: `${overflow.name}\n2026-10-01 ~ 2027-01-13`,
		});
		expect(cells.slice(1).every((c) => c.kind === 'blank')).toBe(true);
	});

	it.each(modes)('clips a %s bar starting last year to W1', (mode) => {
		const p = project({ start: '2026-10-01', end: '2027-01-13' });
		const cells = yearViewCells(p, nextYear, SAT_ON, mode);
		expect(cells[0]!.kind).toBe(mode === 'timeline' ? 'span-solid' : 'span-dashed');
		expect(cells[0]!.spanWeeks).toBe(2);
		expect(cells.slice(1).every((c) => c.kind === 'blank')).toBe(true);
	});

	it.each(modes)('clips a %s bar ending next year to the last week', (mode) => {
		const p = project({ start: '2027-12-20', end: '2028-01-20' });
		const cells = yearViewCells(p, nextYear, SAT_ON, mode);
		expect(cells[50]!.kind).toBe(mode === 'timeline' ? 'span-solid' : 'span-dashed');
		expect(cells[50]!.spanWeeks).toBe(2);
		expect(cells.filter((c) => c.kind !== 'blank')).toHaveLength(1);
	});

	it.each(modes)('clips both ends of a %s bar spanning the whole year', (mode) => {
		const p = project({ start: '2026-10-01', end: '2028-01-20' });
		const cells = yearViewCells(p, nextYear, SAT_ON, mode);
		expect(cells[0]!.kind).toBe(mode === 'timeline' ? 'span-solid' : 'span-dashed');
		expect(cells[0]!.spanWeeks).toBe(52);
		expect(cells.slice(1).every((c) => c.kind === 'blank')).toBe(true);
	});

	it.each(modes)('keeps a %s project outside the shown year blank', (mode) => {
		const p = project({ start: '2026-10-01', end: '2026-12-20' });
		expect(yearViewCells(p, nextYear, SAT_ON, mode).every((c) => c.kind === 'blank')).toBe(true);
	});

	it.each(modes)('handles missing dates and empty weeks in %s mode', (mode) => {
		const cells = yearViewCells(project({ start: null, status: 'done' }), nextYear, SAT_ON, mode);
		expect(cells).toHaveLength(52);
		expect(cells.every((c) => c.kind === 'blank' && c.closed)).toBe(true);
		expect(yearViewCells(overflow, [], SAT_ON, mode)).toEqual([]);
	});

	const unchanged = [
		['no task dates', scanned('🚧 P-範例專案 G.md', [], { 開始日期: '2026-03-02', 預計結束日期: '2026-04-10' })],
		['tasks and settled weeks', scanned('🚧 P-範例專案 H.md', [
			'- [x] 準備 📅 2026-10-14 ✅ 2026-10-13', '- [ ] 開工 📅 2026-11-04',
		], { 開始日期: '2026-10-01', 預計結束日期: '2026-11-29' })],
		['overflow this year', scanned('🚧 P-範例專案 I.md', ['- [ ] 補交成果報告 📅 2026-09-09'], {
			開始日期: '2026-08-03', 預計結束日期: '2026-08-30',
		})],
		['closed project', scanned('✅ P-範例專案 J.md', ['- [x] 結案 📅 2026-06-16 ✅ 2026-06-15'], {
			開始日期: '2026-05-04', 預計結束日期: '2026-06-28',
		})],
		['cancelled project', project({ status: 'cancelled', task_dates: ['2026-06-16'], occupied_weeks: ['2026-W25'] })],
		['starts last year', project({ start: '2025-10-01', end: '2026-04-10' })],
		['ends next year', project({ start: '2026-10-01', end: '2027-04-10' })],
	] as const;

	it.each(unchanged)('matches the direct models for 2026: %s', (_label, p) => {
		expect(yearViewCells(p, weeks, SAT_ON, 'per-week')).toEqual(perWeekCells(p, weeks, SAT_ON));
		expect(yearViewCells(p, weeks, SAT_ON, 'timeline')).toEqual(timelineCells(p, weeks));
	});

	it('changes last year’s finished range only where an overflow task extends into 2026', () => {
		const p = scanned('🚧 P-範例專案 K.md', ['- [ ] 結案報告 📅 2026-01-14'], {
			開始日期: '2025-10-01', 預計結束日期: '2025-12-20',
		});
		expect(perWeekCells(p, weeks, SAT_ON)[2]!.kind).toBe('overflow');
		expect(timelineCells(p, weeks)[0]!.spanWeeks).toBe(3);
		const cells = yearViewCells(p, weeks, SAT_ON, 'per-week');
		expect(cells[2]!.kind).toBe('overflow');
		expect(cells.filter((c) => c.kind !== 'blank')).toHaveLength(1);
		const timeline = yearViewCells(p, weeks, SAT_ON, 'timeline');
		expect(timeline[0]!.kind).toBe('span-solid');
		expect(timeline[0]!.spanWeeks).toBe(3);
		expect(timeline.slice(1).every((c) => c.kind === 'blank')).toBe(true);
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

describe('visibleProjects', () => {
	it('shows 13 active rows by default and 15 with the two paused projects', () => {
		const projects = [
			...Array.from({ length: 13 }, () => project({ status: 'active' })),
			scanned('⏳ P-20260601 範例專案 B.md', [], { 開始日期: '2026-06-01', 預計結束日期: '2026-06-30' }),
			scanned('⏳ P-20260701 範例專案 C.md', [], { 開始日期: '2026-07-01', 預計結束日期: '2026-07-31' }),
		];
		expect(visibleProjects(projects, false, false)).toHaveLength(13);
		expect(visibleProjects(projects, false)).toHaveLength(13);
		expect(visibleProjects(projects, false, true)).toHaveLength(15);
		expect(visibleProjects(projects, false, true).length - visibleProjects(projects, false, false).length).toBe(2);
	});

	it('shows 13 then 20 rows for the closed example while paused stays off', () => {
		const projects = [
			...Array.from({ length: 8 }, () => project({ status: 'pending' })),
			...Array.from({ length: 13 }, () => project({ status: 'active' })),
			...Array.from({ length: 7 }, () => project({ status: 'done' })),
		];
		expect(projects).toHaveLength(28);
		expect(visibleProjects(projects, false, false)).toHaveLength(13);
		expect(visibleProjects(projects, true, false)).toHaveLength(20);
	});

	it.each([false, true])('keeps the paused toggle independent from closed = %s', (closed) => {
		const projects = ['active', 'pending', 'done', 'cancelled'].map((status) => project({ status: status as ProjectRecord['status'] }));
		expect(visibleProjects(projects, closed, false).map((p) => p.status)).toEqual(closed ? ['active', 'done', 'cancelled'] : ['active']);
		expect(visibleProjects(projects, closed, true).map((p) => p.status)).toEqual(closed ? ['active', 'pending', 'done', 'cancelled'] : ['active', 'pending']);
	});

	it('excludes projects without either date even with both toggles on', () => {
		expect(visibleProjects([
			project({ status: 'pending', start: null }), project({ status: 'pending', end: null }),
		], true, true)).toEqual([]);
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

describe('show-every-dated-task rendering matrix', () => {
	it.each([
		['active', '2026-W43', true, false, 'solid'],
		['active', '2026-W43', true, true, 'settled'],
		['active', '2026-W45', true, false, 'solid'],
		['active', '2026-W45', true, true, 'settled'],
		['active', '2026-W46', true, false, 'overflow'],
		['active', '2026-W46', true, true, 'overflow'],
		['active', '2026-W43', false, false, 'blank'],
		['active', '2026-W45', false, false, 'dashed'],
		['active', '2026-W46', false, false, 'blank'],
		['pending', '2026-W43', true, false, 'solid'],
		['pending', '2026-W45', true, true, 'settled'],
		['pending', '2026-W46', true, true, 'overflow'],
		['pending', '2026-W45', false, false, 'dashed'],
		['done', '2026-W43', true, true, 'solid'],
		['done', '2026-W45', true, true, 'solid'],
		['done', '2026-W46', true, true, 'solid'],
		['done', '2026-W45', false, false, 'blank'],
		['cancelled', '2026-W43', true, true, 'solid'],
		['cancelled', '2026-W45', true, true, 'solid'],
		['cancelled', '2026-W46', true, true, 'solid'],
		['cancelled', '2026-W45', false, false, 'blank'],
	] as const)('%s %s occupied=%s settled=%s gives %s', (status, label, occupied, settled, kind) => {
		const p = project({
			status, start: '2026-11-02', end: '2026-11-09',
			task_dates: ['2026-11-04'],
			occupied_weeks: occupied ? [label] : [], settled_weeks: settled ? [label] : [],
		});
		const week = weeks[weekIndex(label)]!;
		expect(weekCellKind(p, week)).toBe(kind);
		expect(perWeekCells(p, [week], SAT_ON)[0]!.kind).toBe(kind);
		expect(yearViewCells(p, weeks, SAT_ON, 'per-week')[weekIndex(label)]!.kind).toBe(kind);
		expect(monthViewCells(p, [week], SAT_ON)[0]!.kind).toBe(kind);
	});

	it('never merges a dashed span over an occupied week when task_dates is empty', () => {
		const p = project({ start: '2026-01-05', end: '2026-04-30', occupied_weeks: ['2026-W03', '2026-W09'] });
		const cells = perWeekCells(p, weeks, SAT_ON);
		expect(cells[weekIndex('2026-W03')]!.kind).toBe('solid');
		expect(cells[weekIndex('2026-W09')]!.kind).toBe('solid');
		expect(cells[weekIndex('2026-W02')]!.kind).toBe('dashed');
	});

	it('uses half-open overlap at the start and end Mondays', () => {
		const p = project({ start: '2026-11-02', end: '2026-11-09', task_dates: ['2026-11-04'] });
		expect(['2026-W44', '2026-W45', '2026-W46'].map((label) => weekCellKind(p, weeks[weekIndex(label)]!)))
			.toEqual(['blank', 'dashed', 'blank']);
	});

	it('renders the mixed-date scenario according to the half-open overlap matrix', () => {
		const p = project({
			start: '2026-01-05', end: '2026-04-30', overflow_end: null,
			task_dates: ['2026-01-14', '2026-02-25'], occupied_weeks: ['2026-W03', '2026-W09'],
		});
		const cells = yearViewCells(p, weeks, SAT_ON, 'per-week');
		expect(cells.map((c) => c.kind)).toEqual(weeks.map((w) => {
			if (w.week === 3 || w.week === 9) return 'solid';
			return w.week >= 2 && w.week <= 18 ? 'dashed' : 'blank';
		}));
	});

	it('renders only the occupied overflow week in the overflow scenario', () => {
		const p = project({
			start: '2026-01-05', end: '2026-04-30', overflow_end: '2026-05-21',
			task_dates: ['2026-05-21'], occupied_weeks: ['2026-W21'],
		});
		const cells = yearViewCells(p, weeks, SAT_ON, 'per-week');
		expect(cells[weekIndex('2026-W21')]!.kind).toBe('overflow');
		expect(cells[weekIndex('2026-W19')]!.kind).toBe('blank');
		expect(cells[weekIndex('2026-W20')]!.kind).toBe('blank');
	});

	it('merges the no-task scenario from W18 through W50', () => {
		const p = project({ start: '2026-04-30', end: '2026-12-13', promised_end: null });
		const cells = yearViewCells(p, weeks, SAT_ON, 'per-week');
		expect(cells[weekIndex('2026-W18')]).toMatchObject({ kind: 'span-dashed', spanWeeks: 33 });
		expect(cells.filter((c) => c.kind !== 'blank')).toHaveLength(1);
		const shown = weeks.slice(30, 35);
		expect(yearViewCells(p, shown, SAT_ON, 'per-week')[0]).toMatchObject({ kind: 'span-dashed', spanWeeks: 5 });
		expect(monthViewCells(p, shown, SAT_ON).map((c) => c.kind)).toEqual(Array<string>(5).fill('dashed'));
	});

	it('renders only W2 and W4 for the closed scenario', () => {
		const p = project({
			status: 'done', start: '2026-01-01', end: '2026-01-31',
			task_dates: ['2026-01-06', '2026-01-20'], occupied_weeks: ['2026-W02', '2026-W04'],
		});
		const cells = yearViewCells(p, weeks, SAT_ON, 'per-week');
		expect(cells.filter((c) => c.kind !== 'blank')).toEqual([
			expect.objectContaining({ kind: 'solid', closed: true }),
			expect.objectContaining({ kind: 'solid', closed: true }),
		]);
		expect(cells[weekIndex('2026-W02')]!.kind).toBe('solid');
		expect(cells[weekIndex('2026-W04')]!.kind).toBe('solid');
	});
});

describe('show-every-dated-task specification scenarios', () => {
	it('A Saturday task after the expected end stays visible', () => {
		const p = scanned('🚧 P-範例專案 L.md', ['- [ ] 追蹤款項 📅 2026-12-05'], {
			開始日期: '2026-06-29', 預計結束日期: '2026-11-06',
		});
		const cells = yearViewCells(p, weeks, SAT_ON, 'per-week');
		expect(cells[weekIndex('2026-W50')]!.kind).toBe('overflow');
		expect(cells[weekIndex('2026-W50')]!.tooltip).toBe(
			`${p.name}\n⚠ overflow 2026-W50（已超出預計結束日期 2026-11-06）\n· 追蹤款項（2026-12-05 預計 (Sat → 本週)）`,
		);
		for (const label of ['2026-W47', '2026-W48', '2026-W49']) expect(cells[weekIndex(label)]!.kind).toBe('blank');
		expect(taskLinesForWeek(p.task_lines, '2026-W50', SAT_ON).map((l) => l.text)).toEqual(['追蹤款項']);
	});

	it('A task before the start date stays visible', () => {
		const p = scanned('🚧 P-範例專案 M.md', ['- [ ] 前置作業 📅 2026-10-28'], {
			開始日期: '2026-11-02', 預計結束日期: '2026-12-31',
		});
		expect(yearViewCells(p, weeks, SAT_ON, 'per-week')[weekIndex('2026-W44')]!.kind).toBe('solid');
		expect(taskLinesForWeek(p.task_lines, '2026-W44', SAT_ON).map((l) => l.text)).toEqual(['前置作業']);
	});

	it("A closed project's task after its end stays visible", () => {
		const p = scanned('✅ P-範例專案 N.md', ['- [x] 結案報告 📅 2026-02-10 ✅ 2026-02-10'], {
			開始日期: '2026-01-01', 預計結束日期: '2026-01-31',
		});
		expect(yearViewCells(p, weeks, SAT_ON, 'per-week')[weekIndex('2026-W07')]).toMatchObject({ kind: 'solid', closed: true });
	});

	it.each(['per-week', 'timeline', 'month'] as const)('An expected end in the year 9999: %s under 50 ms', (mode) => {
		const p = scanned('🚧 P-範例專案 O.md', [], { 開始日期: '2026-01-01', 預計結束日期: '9999-12-31' });
		const shown = mode === 'month' ? weeksOfMonth(2026, 11) : weeks;
		const start = performance.now();
		const cells = mode === 'month' ? monthViewCells(p, shown, SAT_ON) : yearViewCells(p, shown, SAT_ON, mode);
		const elapsed = performance.now() - start;
		expect(elapsed).toBeLessThan(50);
		expect(cells).toHaveLength(shown.length);
		if (mode === 'month') expect(cells.every((c) => c.kind === 'dashed')).toBe(true);
		else expect(cells[0]).toMatchObject({ kind: mode === 'timeline' ? 'span-solid' : 'span-dashed', spanWeeks: shown.length });
	});
});

describe('timeline occupied-week endpoints', () => {
	it('renders the basic timeline scenario from W2 through W18', () => {
		const p = project({ start: '2026-01-05', end: '2026-04-30' });
		const cells = timelineCells(p, weeks);
		expect(cells[weekIndex('2026-W02')]).toMatchObject({ kind: 'span-solid', spanWeeks: 17 });
		expect(cells.filter((c) => c.kind !== 'blank')).toHaveLength(1);
	});

	it('extends the overflow scenario to the last occupied week W21', () => {
		const p = scanned('🚧 P-範例專案 P.md', ['- [ ] 追蹤 📅 2026-05-21'], {
			開始日期: '2026-01-05', 預計結束日期: '2026-04-30',
		});
		expect(timelineCells(p, weeks)[weekIndex('2026-W02')]).toMatchObject({ kind: 'span-solid', spanWeeks: 20 });
	});

	it('extends both ends using unsorted occupied weeks, including a bumped Saturday', () => {
		const p = scanned('🚧 P-範例專案 Q.md', ['- [ ] 追蹤款項 📅 2026-12-05', '- [ ] 前置作業 📅 2026-06-10'], {
			開始日期: '2026-06-29', 預計結束日期: '2026-11-06',
		});
		p.occupied_weeks.reverse();
		const cells = timelineCells(p, weeks);
		expect(cells[weekIndex('2026-W24')]).toMatchObject({ kind: 'span-solid', spanWeeks: 27 });
		expect(cells.filter((c) => c.kind !== 'blank')).toHaveLength(1);
		const shown = weeks.slice(30, 35);
		expect(timelineCells(p, shown)[0]).toMatchObject({ kind: 'span-solid', spanWeeks: 5 });
	});

	it('clips task weeks outside both ends to the first and last shown weeks', () => {
		const p = project({ start: '2026-06-29', end: '2026-11-06', occupied_weeks: ['2027-W02', '2025-W49'] });
		expect(timelineCells(p, weeks)[0]).toMatchObject({ kind: 'span-solid', spanWeeks: 53 });
	});

	it.each(['done', 'cancelled'] as const)('keeps closed styling for %s timelines', (status) => {
		const cells = timelineCells(project({ status, start: '2026-01-01', end: '2026-01-31' }), weeks);
		expect(cells[0]).toMatchObject({ kind: 'span-solid', spanWeeks: 5, closed: true });
	});

	it.each(['start', 'end'] as const)('skips missing %s dates', (field) => {
		expect(timelineCells(project({ [field]: null }), weeks).every((c) => c.kind === 'blank')).toBe(true);
	});
});
