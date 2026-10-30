import { describe, expect, it } from 'vitest';
import {
	buildNewTaskLine,
	locateLine,
	newTaskInsertIndex,
	parseTaskLines,
	readOnlyLineFlags,
	scheduleDateForWeek,
	scheduleLine,
	shiftDueLine,
	taskLinesForWeek,
	toggleDoneLine,
	unscheduledTasks,
	type TaskLine,
} from '../src/core/task-lines';
import { defaultSettings } from '../src/core/settings';
import { weekOfTaskDate } from '../src/core/weeks';

// 預設設定：排進某週寫星期五、週六算當週。
const DEFAULTS = defaultSettings();
const SAT_OFF = { saturdayCountsAsNextWeek: false };
const SAT_ON = { saturdayCountsAsNextWeek: true };

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

	describe('lines in code fences and frontmatter stay read-only', () => {
		// 規格 "Example: fenced and frontmatter lines" 的八行筆記。
		const FENCED_NOTE = [
			'---',
			'tags: [project]',
			'---',
			'- [ ] 真的任務',
			'```md',
			'- [x] 範例任務 📅 2026-11-06',
			'- [ ] 範例待辦',
			'```',
		].join('\n');

		it.each([
			[0, false, undefined],
			[1, false, undefined],
			[2, false, undefined],
			[3, true, true],
			[4, false, undefined],
			[5, true, false],
			[6, false, undefined],
			[7, false, undefined],
		])('line %i: in task_lines = %s, checkbox = %s', (line, included, checkbox) => {
			const found = parseTaskLines(FENCED_NOTE).find((l) => l.line === line);
			expect(found !== undefined).toBe(included);
			if (included) expect(found!.checkbox).toBe(checkbox);
		});

		it('lists exactly the real task and the dated fenced line', () => {
			expect(parseTaskLines(FENCED_NOTE).map((l) => l.line)).toEqual([3, 5]);
		});
	});
});

describe('readOnlyLineFlags', () => {
	it('marks the leading frontmatter including both delimiters', () => {
		expect(readOnlyLineFlags(['---', 'tags: [a]', '---', '- [ ] 任務'])).toEqual([true, true, true, false]);
	});

	it('treats a --- that is not on line 0 as ordinary content', () => {
		expect(readOnlyLineFlags(['# 標題', '---', '- [ ] 任務'])).toEqual([false, false, false]);
	});

	it('marks a whole note as frontmatter when the closing delimiter is missing', () => {
		expect(readOnlyLineFlags(['---', 'tags: [a]'])).toEqual([true, true]);
	});

	it('marks a fenced block including its fence lines', () => {
		expect(readOnlyLineFlags(['a', '```md', '- [ ] x', '```', 'b'])).toEqual([false, true, true, true, false]);
	});

	it('closes a fence only on the same fence character', () => {
		expect(readOnlyLineFlags(['```', '~~~', '- [ ] x', '```', 'b'])).toEqual([true, true, true, true, false]);
	});

	it('supports ~~~ fences', () => {
		expect(readOnlyLineFlags(['~~~', '- [ ] x', '~~~'])).toEqual([true, true, true]);
	});

	it('marks the rest of the note when a fence is never closed', () => {
		expect(readOnlyLineFlags(['a', '```', '- [ ] x'])).toEqual([false, true, true]);
	});

	it('keeps an indented fence a fence (its trimmed start opens it)', () => {
		expect(readOnlyLineFlags(['  ```', '- [ ] x', '  ```', 'b'])).toEqual([true, true, true, false]);
	});
});

describe('unscheduledTasks', () => {
	it('matches the spec example: only open undated checkbox lines count', () => {
		const lines = parseTaskLines(FIVE_LINE_NOTE);
		const result = unscheduledTasks(lines);
		expect(result).toHaveLength(1);
		expect(result[0]!.text).toBe('製作學習日曆');
	});

	it('does not offer a line with a variant date marker for scheduling', () => {
		// 日曆 emoji 後面多了 U+FE0F，解析不出日期，但不能再排一次。
		const lines = parseTaskLines('- [ ] 任務 📅️ 2026-11-06');
		expect(lines).toHaveLength(1);
		expect(lines[0]!.dates).toEqual([]);
		expect(unscheduledTasks(lines)).toEqual([]);
	});

	it('does not offer a checkbox line inside a code fence', () => {
		const lines = parseTaskLines(['```md', '- [ ] 範例待辦', '```'].join('\n'));
		expect(unscheduledTasks(lines)).toEqual([]);
	});
});

describe('taskLinesForWeek', () => {
	it('lists a line with two dates in the same week exactly once', () => {
		const lines = parseTaskLines('- [x] 租借場地 📅 2026-10-27 ✅ 2026-10-26');
		const result = taskLinesForWeek(lines, '2026-W44', DEFAULTS);
		expect(result).toHaveLength(1);
		expect(result[0]!.text).toBe('租借場地');
	});

	it('shows a Saturday task in the following week only when the setting is on', () => {
		const lines = parseTaskLines('- [ ] 寄出合約 📅 2026-10-31');
		expect(taskLinesForWeek(lines, '2026-W45', SAT_ON)).toHaveLength(1);
		expect(taskLinesForWeek(lines, '2026-W44', SAT_ON)).toHaveLength(0);
	});

	it('keeps a Saturday task in its own week when the setting is off', () => {
		const lines = parseTaskLines('- [ ] 寄出合約 📅 2026-10-31');
		expect(taskLinesForWeek(lines, '2026-W44', SAT_OFF)).toHaveLength(1);
		expect(taskLinesForWeek(lines, '2026-W45', SAT_OFF)).toHaveLength(0);
	});

	it('sorts by the earliest date mapping to the week, then by line index', () => {
		const text = [
			'- [ ] 晚一點的 📅 2026-10-29',
			'- [ ] 早一點的 📅 2026-10-27',
		].join('\n');
		const lines = parseTaskLines(text);
		const result = taskLinesForWeek(lines, '2026-W44', DEFAULTS);
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
		[
			'- [ ] 確認拍攝服裝 📅 2026-10-30 ^abc123 ',
			'- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28 ^abc123 ',
		],
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

// Example: shift rewrites（dashboard-task-editing）：每一列的改寫結果，以及改寫後
// 在週六規則關／開兩種設定下顯示在哪一週。
describe('shift rewrites and the week shown afterwards', () => {
	it.each([
		['- [ ] 確認拍攝服裝 📅 2026-10-30', 7, '- [ ] 確認拍攝服裝 📅 2026-11-06', '2026-W45', '2026-W45'],
		['- [ ] 寄出合約 📅 2026-10-31', 7, '- [ ] 寄出合約 📅 2026-11-07', '2026-W45', '2026-W46'],
		['- [ ] 年度回顧 📅 2026-01-02', -7, '- [ ] 年度回顧 📅 2025-12-26', '2025-W52', '2025-W52'],
	])('%s shifted by %i -> %s (off: %s, on: %s)', (before, days, after, weekOff, weekOn) => {
		expect(shiftDueLine(before, days)).toBe(after);
		const lines = parseTaskLines(after);
		expect(taskLinesForWeek(lines, weekOff, SAT_OFF)).toHaveLength(1);
		expect(taskLinesForWeek(lines, weekOn, SAT_ON)).toHaveLength(1);
		expect(weekOfTaskDate(lines[0]!.due!, SAT_OFF)!.label).toBe(weekOff);
		expect(weekOfTaskDate(lines[0]!.due!, SAT_ON)!.label).toBe(weekOn);
	});
});

describe('scheduleLine / scheduleDateForWeek', () => {
	// Example: schedule dates with the default settings（dashboard-task-editing）。
	it.each([
		['2026-W45', '- [ ] 製作學習日曆', '- [ ] 製作學習日曆 📅 2026-11-06', '2026-11-06'],
		['2026-W53', '- [ ] 年度回顧', '- [ ] 年度回顧 📅 2027-01-01', '2027-01-01'],
		['2027-W01', '- [ ] 新年計畫 ^plan1', '- [ ] 新年計畫 📅 2027-01-08 ^plan1', '2027-01-08'],
		['2027-W02', '- [ ] 新年計畫 ^plan1 ', '- [ ] 新年計畫 📅 2027-01-15 ^plan1 ', '2027-01-15'],
	])('%s with the default settings: %s -> %s', (week, before, after, expectedDate) => {
		const date = scheduleDateForWeek(week, DEFAULTS);
		expect(date).toBe(expectedDate);
		expect(scheduleLine(before, date)).toBe(after);
		// 排進某週的任務一定顯示在那一週。
		expect(weekOfTaskDate(date, DEFAULTS)!.label).toBe(week);
	});

	// Example: schedule date by setting（dashboard-task-editing）：一列一個測試。
	it.each([
		['2026-W45', 5, false, '2026-11-06'],
		['2026-W45', 5, true, '2026-11-06'],
		['2026-W45', 1, false, '2026-11-02'],
		['2026-W45', 6, false, '2026-11-07'],
		['2026-W45', 6, true, '2026-10-31'],
		['2026-W45', 7, true, '2026-11-08'],
		['2027-W01', 6, true, '2027-01-02'],
	])('%s with weekday %i and Saturday rule %s -> %s', (week, scheduleWeekday, saturdayCountsAsNextWeek, expected) => {
		const rules = { scheduleWeekday, saturdayCountsAsNextWeek };
		expect(scheduleDateForWeek(week, rules)).toBe(expected);
		expect(weekOfTaskDate(expected, rules)!.label).toBe(week);
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

	it('ignores checkbox lines inside a code fence', () => {
		expect(newTaskInsertIndex(['- [ ] A', '```md', '- [ ] 範例', '```', ''])).toBe(1);
	});

	it('ignores checkbox lines inside the frontmatter', () => {
		expect(newTaskInsertIndex(['---', '- [ ] 不是任務', '---', '## 備註'])).toBe(4);
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

describe('completion needs a ✅ date marker', () => {
	const LINKED = '- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]] 📅 2026-11-07';

	it('A link to a finished note does not mark a task done', () => {
		const [line] = parseTaskLines(LINKED);
		expect(line).toMatchObject({ done: false, due: '2026-11-07', doneDate: null, dates: ['2026-11-07'] });
	});

	it('ticking such a line appends today instead of being a no-op', () => {
		expect(toggleDoneLine(LINKED, '2026-10-28')).toBe(`${LINKED.replace('- [ ]', '- [x]')} ✅ 2026-10-28`);
	});

	it('A link to a finished note can still be scheduled', () => {
		const undated = parseTaskLines('- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]]');
		expect(unscheduledTasks(undated).map((l) => l.text)).toEqual(['追蹤後續 [[✅ P-2026 範例：已完成專案]]']);
	});

	it('a ✅ with a slash date still blocks scheduling (left to the note)', () => {
		expect(unscheduledTasks(parseTaskLines('- [ ] 回覆信件 ✅ 2026/10/20'))).toEqual([]);
	});
});
