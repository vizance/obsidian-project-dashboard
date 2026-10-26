import { describe, expect, it } from 'vitest';
import { perWeekCells, sortProjects, timelineCells } from '../src/core/cells';
import type { ProjectRecord } from '../src/core/scan';
import { buildWeeks, type WeekInfo } from '../src/core/weeks';

const weeks: WeekInfo[] = buildWeeks(2026);

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

describe('perWeekCells — per-week cell kinds', () => {
	it('solid: active, week in [start, end], has an incomplete task that week (W44)', () => {
		const p = project({ task_dates: ['2026-10-26'], occupied_weeks: ['2026-W44'], settled_weeks: [] });
		const cells = perWeekCells(p, weeks);
		expect(cells[weekIndex('2026-W44')]!.kind).toBe('solid');
	});

	it('settled: active, week in [start, end], all tasks that week complete (W30)', () => {
		const p = project({ task_dates: ['2026-07-20'], occupied_weeks: ['2026-W30'], settled_weeks: ['2026-W30'] });
		const cells = perWeekCells(p, weeks);
		expect(cells[weekIndex('2026-W30')]!.kind).toBe('settled');
	});

	it('dashed: active, week in [start, end], no task that week (W40)', () => {
		const p = project({ task_dates: ['2026-09-21'], occupied_weeks: [], settled_weeks: [] });
		const cells = perWeekCells(p, weeks);
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
		const cells = perWeekCells(p, weeks);
		expect(cells[weekIndex('2026-W50')]!.kind).toBe('overflow');
	});

	it('span-dashed: active, no task dates at all, first week of [start, end]', () => {
		const p = project({ start: '2026-02-02', end: '2026-02-28', task_dates: [] });
		const cells = perWeekCells(p, weeks);
		const startIdx = weeks.findIndex((w) => new Date('2026-02-28T00:00:00Z') >= w.start && new Date('2026-02-02T00:00:00Z') < w.end);
		expect(cells[startIdx]!.kind).toBe('span-dashed');
	});

	it('blank: done, week in [start, end], no task that week (W40)', () => {
		const p = project({ status: 'done', occupied_weeks: [], settled_weeks: [] });
		const cells = perWeekCells(p, weeks);
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
		const cells = perWeekCells(p, weeks);
		expect(cells[weekIndex('2026-W50')]!.kind).toBe('overflow');
	});

	it('produces an exact tooltip string for a Saturday-bumped task', () => {
		const p = project({
			task_dates: ['2026-10-31'],
			occupied_weeks: ['2026-W45'],
			settled_weeks: [],
			tasks: [{ date: '2026-10-31', kind: 'planned', text: '盤點', done: false }],
		});
		const cells = perWeekCells(p, weeks);
		expect(cells[weekIndex('2026-W45')]!.tooltip).toBe(
			'P-測試專案\n2026-W45\n· 盤點（2026-10-31 預計 (Sat → 本週)）',
		);
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
