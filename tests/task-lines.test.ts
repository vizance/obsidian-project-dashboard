import { describe, expect, it } from 'vitest';
import {
	buildNewTaskLine,
	locateLine,
	newTaskInsertIndex,
	parseTaskLines,
	scheduleDateForWeek,
	scheduleLine,
	shiftDueLine,
	taskLinesForWeek,
	toggleDoneLine,
	unscheduledTasks,
	type TaskLine,
} from '../src/core/task-lines';

const FIVE_LINE_NOTE = [
	'## 拍攝',
	'- [ ] 確認拍攝服裝 📅 2026-10-30',
	'- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26',
	'  - [ ] 製作學習日曆',
	'會議紀錄 📅 2026-10-29',
].join('\n');

describe('parseTaskLines', () => {
	it('matches the spec example: one note, five lines', () => {
		const lines = parseTaskLines(FIVE_LINE_NOTE);
		expect(lines).toEqual<TaskLine[]>([
			{
				line: 1,
				raw: '- [ ] 確認拍攝服裝 📅 2026-10-30',
				text: '確認拍攝服裝',
				checkbox: true,
				done: false,
				due: '2026-10-30',
				doneDate: null,
				recurring: false,
				dates: ['2026-10-30'],
			},
			{
				line: 2,
				raw: '- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26',
				text: '租借場地',
				checkbox: true,
				done: true,
				due: '2026-10-27',
				doneDate: '2026-10-26',
				recurring: false,
				dates: ['2026-10-27', '2026-10-26'],
			},
			{
				line: 3,
				raw: '  - [ ] 製作學習日曆',
				text: '製作學習日曆',
				checkbox: true,
				done: false,
				due: null,
				doneDate: null,
				recurring: false,
				dates: [],
			},
			{
				line: 4,
				raw: '會議紀錄 📅 2026-10-29',
				text: '會議紀錄',
				checkbox: false,
				done: false,
				due: '2026-10-29',
				doneDate: null,
				recurring: false,
				dates: ['2026-10-29'],
			},
		]);
	});

	it('handles \\r\\n line endings (raw has no \\r)', () => {
		const text = '- [ ] A 📅 2026-10-30\r\n- [ ] B\r\n';
		const lines = parseTaskLines(text);
		expect(lines.map((l) => l.raw)).toEqual(['- [ ] A 📅 2026-10-30', '- [ ] B']);
		expect(lines.map((l) => l.line)).toEqual([0, 1]);
	});

	describe('custom checkbox status stays read-only', () => {
		it('keeps a dated custom-status line with checkbox = false', () => {
			const lines = parseTaskLines('- [/] 剪輯第一支影片 📅 2026-10-29');
			expect(lines).toHaveLength(1);
			expect(lines[0]!.checkbox).toBe(false);
		});

		it('excludes an undated custom-status line entirely', () => {
			expect(parseTaskLines('- [-] 取消的任務')).toEqual([]);
		});
	});
});

describe('unscheduledTasks', () => {
	it('matches the spec example: only open undated checkbox lines count', () => {
		const lines = parseTaskLines(FIVE_LINE_NOTE);
		const result = unscheduledTasks(lines);
		expect(result).toHaveLength(1);
		expect(result[0]!.text).toBe('製作學習日曆');
	});
});

describe('taskLinesForWeek', () => {
	it('lists a line with two dates in the same week exactly once', () => {
		const lines = parseTaskLines('- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26');
		const result = taskLinesForWeek(lines, '2026-W44');
		expect(result).toHaveLength(1);
		expect(result[0]!.text).toBe('租借場地');
	});

	it('shows a Saturday task in the following week only', () => {
		const lines = parseTaskLines('- [ ] 寄出合約 📅 2026-10-31');
		expect(taskLinesForWeek(lines, '2026-W45')).toHaveLength(1);
		expect(taskLinesForWeek(lines, '2026-W44')).toHaveLength(0);
	});

	it('sorts by the earliest date mapping to the week, then by line index', () => {
		const text = [
			'- [ ] 晚一點的 📅 2026-10-29',
			'- [ ] 早一點的 📅 2026-10-27',
		].join('\n');
		const lines = parseTaskLines(text);
		const result = taskLinesForWeek(lines, '2026-W44');
		expect(result.map((l) => l.text)).toEqual(['早一點的', '晚一點的']);
	});
});

describe('toggleDoneLine', () => {
	const today = '2026-10-28';

	it.each([
		['- [ ] 確認拍攝服裝 📅 2026-10-30', '- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28'],
		['- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28', '- [ ] 確認拍攝服裝 📅 2026-10-30'],
		['- [ ] 確認拍攝服裝 📅 2026-10-30 ^abc123', '- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28 ^abc123'],
		['- [ ] 回覆信件 ✅ 2026-10-20', '- [ ] 回覆信件'],
		['\t- [ ] 子任務 📅 2026-10-29', '\t- [x] 子任務 📅 2026-10-29 ✅ 2026-10-28'],
	])('%s -> %s', (before, after) => {
		expect(toggleDoneLine(before, today)).toBe(after);
	});
});

describe('shiftDueLine', () => {
	it.each([
		['- [ ] 確認拍攝服裝 📅 2026-10-30', 7, '- [ ] 確認拍攝服裝 📅 2026-11-06'],
		['- [ ] 寄出合約 📅 2026-10-31', 7, '- [ ] 寄出合約 📅 2026-11-07'],
		['- [ ] 年度回顧 📅 2026-01-02', -7, '- [ ] 年度回顧 📅 2025-12-26'],
	])('%s shifted by %i -> %s', (before, days, after) => {
		expect(shiftDueLine(before, days)).toBe(after);
	});
});

describe('scheduleLine / scheduleDateForWeek', () => {
	it.each([
		['2026-W45', '- [ ] 製作學習日曆', '- [ ] 製作學習日曆 📅 2026-11-06'],
		['2026-W53', '- [ ] 年度回顧', '- [ ] 年度回顧 📅 2027-01-01'],
		['2027-W01', '- [ ] 新年計畫 ^plan1', '- [ ] 新年計畫 📅 2027-01-08 ^plan1'],
	])('%s: %s -> %s', (week, before, after) => {
		const date = scheduleDateForWeek(week);
		expect(scheduleLine(before, date)).toBe(after);
	});

	it.each([
		['2026-W45', '2026-11-06'],
		['2026-W53', '2027-01-01'],
		['2027-W01', '2027-01-08'],
	])('scheduleDateForWeek(%s) -> %s', (week, expected) => {
		expect(scheduleDateForWeek(week)).toBe(expected);
	});
});

describe('buildNewTaskLine', () => {
	it('collapses whitespace/newlines and appends the schedule date', () => {
		expect(buildNewTaskLine('寄出 邀請函', '2026-11-06')).toBe('- [ ] 寄出 邀請函 📅 2026-11-06');
	});

	it('collapses internal newlines and runs of whitespace', () => {
		expect(buildNewTaskLine('寄出\n\n 邀請函   了', '2026-11-06')).toBe('- [ ] 寄出 邀請函 了 📅 2026-11-06');
	});

	it('keeps the user-supplied date unchanged instead of appending one', () => {
		expect(buildNewTaskLine('寄出邀請函 📅 2026-12-01', '2026-11-06')).toBe('- [ ] 寄出邀請函 📅 2026-12-01');
	});

	it('returns null for an empty or whitespace-only input', () => {
		expect(buildNewTaskLine('   ', '2026-11-06')).toBeNull();
		expect(buildNewTaskLine('', '2026-11-06')).toBeNull();
	});
});

describe('newTaskInsertIndex', () => {
	it('matches the spec example: new task lands after the last task line', () => {
		const lines = [
			'## 拍攝',
			'- [ ] 確認拍攝服裝 📅 2026-10-30',
			'- [x] 租借場地 ✅ 2026-10-26',
			'',
			'## 備註',
		];
		expect(newTaskInsertIndex(lines)).toBe(3);
	});

	it('appends at the end when there is no checkbox task line', () => {
		expect(newTaskInsertIndex(['## 拍攝', '會議紀錄'])).toBe(2);
	});
});

describe('locateLine', () => {
	const lines = ['A', 'B', 'C'];

	it('uses the recorded index when it still matches', () => {
		expect(locateLine(lines, 1, 'B')).toBe(1);
	});

	it('finds the unique match when the line moved down', () => {
		const moved = ['X', 'Y', 'A', 'B', 'C'];
		expect(locateLine(moved, 1, 'B')).toBe(3);
	});

	it('returns -1 when the recorded index no longer matches and the text is ambiguous', () => {
		const duplicated = ['X', 'B', 'Y', 'B'];
		expect(locateLine(duplicated, 0, 'B')).toBe(-1);
	});
});
