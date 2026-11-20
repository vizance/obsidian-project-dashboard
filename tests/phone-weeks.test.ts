import { describe, expect, it } from 'vitest';
import { visibleProjects } from '../src/core/cells';
import {
	overdueLines,
	phoneWeekGroups,
	phoneWeekLabels,
	scheduleToThisWeekDays,
} from '../src/core/phone-weeks';
import type { ProjectRecord } from '../src/core/scan';
import { parseTaskLines, taskLinesForWeek } from '../src/core/task-lines';
import type { WeekRules } from '../src/core/weeks';

const SAT_OFF: WeekRules = { saturdayCountsAsNextWeek: false };
const SAT_ON: WeekRules = { saturdayCountsAsNextWeek: true };
const TODAY = '2026-11-20';
const WEEK_LABELS = ['2026-W47', '2026-W48', '2026-W49', '2026-W50'];

function project(text: string, overrides: Partial<ProjectRecord> = {}): ProjectRecord {
	return {
		name: '範例專案 A',
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
		path: '/tmp/範例專案 A.md',
		task_lines: parseTaskLines(text),
		...overrides,
	};
}

describe('phoneWeekLabels', () => {
	it('Four weeks from today', () => {
		expect(phoneWeekLabels(TODAY)).toEqual(WEEK_LABELS);
	});

	it('The four weeks cross into the next year', () => {
		expect(phoneWeekLabels('2026-12-30')).toEqual([
			'2026-W53', '2027-W01', '2027-W02', '2027-W03',
		]);
	});

	it('Four weeks from today: Saturday uses the ISO week containing today', () => {
		expect(phoneWeekLabels('2026-11-28')).toEqual([
			'2026-W48', '2026-W49', '2026-W50', '2026-W51',
		]);
	});
});

describe('phoneWeekGroups', () => {
	const exampleProject = project([
		'- [ ] 寄出邀請 📅 2026-11-06',
		'- [ ] 準備讀書會 📅 2026-11-20',
		'- [ ] 訂場地 📅 2026-12-11',
		'- [ ] 寄成果報告 📅 2026-12-18',
	].join('\n'));

	it.each([
		['寄出邀請', 0, null, true],
		['準備讀書會', 1, '2026-W47', false],
		['訂場地', 2, '2026-W50', false],
		['寄成果報告', 3, null, false],
	] as const)('Four weeks from today: where each task appears — %s', (_text, index, week, overdue) => {
		const line = exampleProject.task_lines[index]!;
		const weeks = phoneWeekGroups([exampleProject], WEEK_LABELS, SAT_OFF);
		for (const label of WEEK_LABELS) {
			const lines = weeks.find((entry: { week: string }) => entry.week === label)?.groups[0]?.lines ?? [];
			if (label === week) expect(lines).toContainEqual(line);
			else expect(lines).not.toContainEqual(line);
		}
		const earlier = overdueLines([exampleProject], SAT_OFF, TODAY);
		if (overdue) expect(earlier).toEqual([{ project: exampleProject, lines: [line] }]);
		else expect(earlier[0]?.lines ?? []).not.toContainEqual(line);
	});

	it('Four weeks from today: W48 and W49 have empty groups', () => {
		expect(phoneWeekGroups([exampleProject], WEEK_LABELS, SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [{ project: exampleProject, lines: [exampleProject.task_lines[1]!] }] },
			{ week: '2026-W48', groups: [] },
			{ week: '2026-W49', groups: [] },
			{ week: '2026-W50', groups: [{ project: exampleProject, lines: [exampleProject.task_lines[2]!] }] },
		]);
	});

	it('The Saturday rule decides the week', () => {
		const p = project('- [ ] 整理照片 📅 2026-11-28');
		expect(phoneWeekGroups([p], WEEK_LABELS, SAT_ON)).toEqual([
			{ week: '2026-W47', groups: [] },
			{ week: '2026-W48', groups: [] },
			{ week: '2026-W49', groups: [{ project: p, lines: p.task_lines }] },
			{ week: '2026-W50', groups: [] },
		]);
	});

	it('Projects follow the dashboard\'s row order', () => {
		const a = project('- [ ] 準備讀書會 📅 2026-11-20');
		const b = project('- [ ] 整理清單 📅 2026-11-19', {
			name: '範例專案 B', path: '/tmp/範例專案 B.md',
		});
		const empty = project('- [ ] 尚未排日期');
		expect(phoneWeekGroups([b, empty, a], ['2026-W47'], SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [
				{ project: b, lines: b.task_lines },
				{ project: a, lines: a.task_lines },
			] },
		]);
	});

	it('Projects follow the dashboard\'s row order: task lines keep the week-popover result and order', () => {
		const p = project([
			'- [ ] 週報 🔁 every week 📅 2026-11-20',
			'會議紀錄 📅 2026-11-16',
			'- [x] 整理閱讀清單 ✅ 2026-11-19',
			'- [ ] 確認名單 📅 2026-11-19',
			'- [ ] 之後的任務 📅 2026-11-27',
		].join('\n'));
		const expected = [p.task_lines[1]!, p.task_lines[2]!, p.task_lines[3]!, p.task_lines[0]!];
		expect(taskLinesForWeek(p.task_lines, '2026-W47', SAT_OFF)).toEqual(expected);
		expect(phoneWeekGroups([p], ['2026-W47'], SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [{ project: p, lines: expected }] },
		]);
	});

	it('Paused projects appear only when checked', () => {
		const p = project('- [ ] 準備讀書會 📅 2026-11-20', { status: 'pending' });
		// 篩選由 view 沿用既有規則，純計算只接收已篩選的列。
		expect(phoneWeekGroups(visibleProjects([p], false, false), ['2026-W47'], SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [] },
		]);
		expect(phoneWeekGroups(visibleProjects([p], false, true), ['2026-W47'], SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [{ project: p, lines: p.task_lines }] },
		]);
	});

	it('A done task stays in its week', () => {
		const p = project('- [x] 整理閱讀清單 📅 2026-11-19 ✅ 2026-11-19');
		expect(phoneWeekGroups([p], ['2026-W47'], SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [{ project: p, lines: p.task_lines }] },
		]);
		expect(p.task_lines[0]!.done).toBe(true);
		expect(overdueLines([p], SAT_OFF, TODAY)).toEqual([]);
	});

	it('Earlier days of this week are not overdue', () => {
		const p = project('- [ ] 回覆信件 📅 2026-11-16');
		expect(phoneWeekGroups([p], ['2026-W47'], SAT_OFF)).toEqual([
			{ week: '2026-W47', groups: [{ project: p, lines: p.task_lines }] },
		]);
		expect(overdueLines([p], SAT_OFF, TODAY)).toEqual([]);
	});
});

describe('overdueLines', () => {
	it('Scheduling an overdue task into this week: overdue lines follow project order, then due date and line order', () => {
		const a = project('- [ ] 寄出邀請 📅 2026-11-06');
		const b = project([
			'- [ ] 後到期 📅 2026-11-10',
			'- [ ] 先到期 📅 2026-11-03',
			'- [ ] 同日另一項 📅 2026-11-03',
			'會議紀錄 📅 2026-11-06',
			'- [ ] 還沒排日期',
			'- [x] 已打勾 📅 2026-11-03',
			'- [ ] 已有完成日期 📅 2026-11-03 ✅ 2026-11-04',
		].join('\n'), { name: '範例專案 B', path: '/tmp/範例專案 B.md' });
		const empty = project('- [ ] 準備讀書會 📅 2026-11-20');
		expect(overdueLines([b, empty, a], SAT_OFF, TODAY)).toEqual([
			{ project: b, lines: [b.task_lines[1]!, b.task_lines[2]!, b.task_lines[0]!] },
			{ project: a, lines: a.task_lines },
		]);
	});

	it('The Saturday rule decides the week: the previous Saturday is not overdue when it maps to this week', () => {
		const p = project('- [ ] 整理照片 📅 2026-11-14');
		expect(overdueLines([p], SAT_ON, TODAY)).toEqual([]);
		expect(phoneWeekGroups([p], ['2026-W47'], SAT_ON)).toEqual([
			{ week: '2026-W47', groups: [{ project: p, lines: p.task_lines }] },
		]);
		expect(overdueLines([p], SAT_OFF, TODAY)).toEqual([{ project: p, lines: p.task_lines }]);
	});
});

describe('scheduleToThisWeekDays', () => {
	it('Scheduling an overdue task into this week', () => {
		const line = parseTaskLines('- [ ] 寄出邀請 📅 2026-11-06')[0]!;
		expect(scheduleToThisWeekDays(line, { ...SAT_OFF, scheduleWeekday: 5 }, TODAY)).toBe(14);
	});

	it('Scheduling into this week with the Saturday exception', () => {
		const line = parseTaskLines('- [ ] 寄出邀請 📅 2026-11-06')[0]!;
		expect(scheduleToThisWeekDays(line, { ...SAT_ON, scheduleWeekday: 6 }, TODAY)).toBe(8);
	});
});
