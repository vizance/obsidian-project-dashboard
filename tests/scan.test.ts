import { describe, expect, it } from 'vitest';
import {
	classify,
	computeOccupiedWeeks,
	detectStatus,
	parseDateStr,
	parseFilenameDates,
	parseFrontmatter,
	parseTaskDates,
	parseTasks,
	scanProjectFolder,
	scanProjectNote,
	stripStatus,
} from '../src/core/scan';

describe('detectStatus', () => {
	it.each([
		['🚧 P-foo.md', 'active'],
		['⏳ P-foo.md', 'pending'],
		['✅ P-foo.md', 'done'],
		['❌ P-foo.md', 'cancelled'],
		['P-foo.md', 'active'],
	])('%s -> %s', (filename, expected) => {
		expect(detectStatus(filename)).toBe(expected);
	});
});

describe('stripStatus', () => {
	it('removes the status emoji and the .md suffix', () => {
		expect(stripStatus('🚧 P-20260413 範例專案.md')).toBe('P-20260413 範例專案');
	});

	it('leaves a name without a status emoji untouched aside from the suffix', () => {
		expect(stripStatus('P-2026 範例：家庭生活專案 @小明 @小美.md')).toBe('P-2026 範例：家庭生活專案 @小明 @小美');
	});
});

describe('parseFrontmatter', () => {
	it('parses a colon-split frontmatter block', () => {
		const text = '---\n開始日期: 2026-01-05\n預計結束日期: 2026-03-01\n---\n\n內容';
		expect(parseFrontmatter(text)).toEqual({
			開始日期: '2026-01-05',
			預計結束日期: '2026-03-01',
		});
	});

	it('returns {} when the text has no frontmatter block', () => {
		expect(parseFrontmatter('沒有 frontmatter')).toEqual({});
	});

	it('ignores lines without a colon', () => {
		const text = '---\nno colon here\n開始日期: 2026-01-05\n---\n';
		expect(parseFrontmatter(text)).toEqual({ 開始日期: '2026-01-05' });
	});
});

describe('classify', () => {
	it('applies a full-name override with the highest priority', () => {
		expect(classify('P-2026 範例：家庭生活專案 @小明 @小美', { 'P-2026 範例：家庭生活專案 @小明 @小美': 'life' })).toBe('life');
	});

	it('does not apply an override to a different project name', () => {
		expect(classify('P-2026 其他專案', { 'P-2026 範例：家庭生活專案 @小明 @小美': 'life' })).toBe('other');
	});

	it('falls back to name-fragment rules', () => {
		expect(classify('P-2026 特別接案專案')).toBe('coaching');
	});

	it('falls back to keyword rules', () => {
		expect(classify('P-2026 線上課程製作')).toBe('online_course');
	});

	it('returns other when nothing matches', () => {
		expect(classify('P-2026 隨便一個名字')).toBe('other');
	});
});

describe('parseDateStr', () => {
	it('extracts an ISO date embedded in a longer string', () => {
		expect(parseDateStr('2026-03-01')).toBe('2026-03-01');
	});

	it('returns null when there is no date', () => {
		expect(parseDateStr('')).toBeNull();
		expect(parseDateStr(undefined)).toBeNull();
	});
});

describe('parseFilenameDates', () => {
	it('parses a full 8-digit range', () => {
		expect(parseFilenameDates('P-20260413 ~ 1213 範例專案')).toEqual(['2026-04-13', '2026-12-13']);
	});

	it('parses a range whose end repeats the year', () => {
		expect(parseFilenameDates('P-20260101 ~ 20260111 測試')).toEqual(['2026-01-01', '2026-01-11']);
	});

	it('parses a single embedded date with no range', () => {
		expect(parseFilenameDates('P-20260515 線上課程製作')).toEqual(['2026-05-15', '2026-05-15']);
	});

	it('parses a short "&" trailing date using the first date\'s year', () => {
		expect(parseFilenameDates('P-20260101 & 0111 測試')).toEqual(['2026-01-01', '2026-01-11']);
	});

	it('returns [null, null] when there is no embeddded date', () => {
		expect(parseFilenameDates('P-2026 範例：家庭生活專案 @小明 @小美')).toEqual([null, null]);
	});

	it('does not match an 8-digit substring inside a longer digit run', () => {
		expect(parseFilenameDates('P-123456789 測試')).toEqual([null, null]);
	});
});

describe('parseTaskDates', () => {
	it('extracts dates after 📅 and ✅ markers', () => {
		expect(parseTaskDates('- [ ] 確認拍攝服裝 📅 2026-10-30\n- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15')).toEqual([
			'2026-10-30',
			'2026-05-14',
			'2026-05-15',
		]);
	});
});

describe('parseTasks', () => {
	it('parses a planned task line', () => {
		expect(parseTasks('- [ ] 確認拍攝服裝 📅 2026-10-30')).toEqual([
			{ date: '2026-10-30', kind: 'planned', text: '確認拍攝服裝', done: false },
		]);
	});

	it('parses a done task line with both a planned and a done marker', () => {
		expect(parseTasks('- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15')).toEqual([
			{ date: '2026-05-14', kind: 'planned', text: '寄出提案', done: true },
			{ date: '2026-05-15', kind: 'done', text: '寄出提案', done: true },
		]);
	});

	it('marks a line done when it contains ✅ without a checked checkbox', () => {
		expect(parseTasks('- [ ] 寄出提案 ✅ 2026-05-15')).toEqual([
			{ date: '2026-05-15', kind: 'done', text: '寄出提案', done: true },
		]);
	});

	it('strips the " > [[link]]" tail and collapses whitespace', () => {
		expect(parseTasks('- [ ]   確認   拍攝服裝   📅 2026-10-30 > [[某筆記]]')).toEqual([
			{ date: '2026-10-30', kind: 'planned', text: '確認 拍攝服裝', done: false },
		]);
	});
});

describe('computeOccupiedWeeks', () => {
	it('maps a Friday to its own ISO week', () => {
		expect(computeOccupiedWeeks(['2026-10-30'])).toEqual(['2026-W44']);
	});

	it('rolls a Saturday into the following week', () => {
		expect(computeOccupiedWeeks(['2026-10-31'])).toEqual(['2026-W45']);
	});

	it('dedupes and sorts labels', () => {
		expect(computeOccupiedWeeks(['2026-10-30', '2026-05-14', '2026-10-30'])).toEqual(['2026-W20', '2026-W44']);
	});

	it('ignores unparseable dates', () => {
		expect(computeOccupiedWeeks(['not-a-date'])).toEqual([]);
	});
});

describe('scanProjectNote', () => {
	const today = '2026-10-25';

	it('returns null for an excluded project', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-2026 內部測試用專案.md', text: '', path: 'x.md' },
			{ overrides: {}, today },
		);
		expect(result).toBeNull();
	});

	it('matches the spec example: filename-derived dates with life category', () => {
		const result = scanProjectNote(
			{
				filename: '🚧 P-20260413 ~ 1213 範例：家庭生活專案.md',
				text: '',
				path: 'x.md',
			},
			{ overrides: {}, today },
		);
		expect(result?.status).toBe('active');
		expect(result?.start).toBe('2026-04-13');
		expect(result?.end).toBe('2026-12-13');
		expect(result?.warnings).toEqual(['起日由檔名推得', '迄日由檔名推得']);
		expect(result?.category).toBe('life');
	});

	it('matches the spec example: done status with other category', () => {
		const result = scanProjectNote(
			{ filename: '✅ P-2026 範例：已完成專案.md', text: '', path: 'x.md' },
			{ overrides: {}, today },
		);
		expect(result?.status).toBe('done');
		expect(result?.category).toBe('other');
	});

	it('matches the spec example: planned task occupies W44', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 確認拍攝服裝 📅 2026-10-30', path: 'x.md' },
			{ overrides: {}, today },
		);
		expect(result?.tasks).toEqual([{ date: '2026-10-30', kind: 'planned', text: '確認拍攝服裝', done: false }]);
		expect(result?.occupied_weeks).toContain('2026-W44');
	});

	it('matches the spec example: Saturday task occupies W45 and sets promised_end', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 盤點 📅 2026-10-31', path: 'x.md' },
			{ overrides: {}, today },
		);
		expect(result?.occupied_weeks).toContain('2026-W45');
		expect(result?.promised_end).toBe('2026-10-31');
	});

	it('matches the spec example: both dates of a done task settle when uncontested', () => {
		const result = scanProjectNote(
			{
				filename: '🚧 P-20260101 ~ 1231 測試.md',
				text: '- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15',
				path: 'x.md',
			},
			{ overrides: {}, today },
		);
		const plannedWeek = computeOccupiedWeeks(['2026-05-14'])[0];
		const doneWeek = computeOccupiedWeeks(['2026-05-15'])[0];
		expect(result?.settled_weeks).toContain(plannedWeek);
		expect(result?.settled_weeks).toContain(doneWeek);
	});

	it('A link to a finished note does not complete a task: its week stays outstanding', () => {
		const result = scanProjectNote(
			{
				filename: '🚧 P-20260101 ~ 1231 測試.md',
				text: '- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]] 📅 2026-06-02',
				path: 'x.md',
			},
			{ overrides: {}, today },
		);
		expect(result?.occupied_weeks).toContain('2026-W23');
		expect(result?.settled_weeks).not.toContain('2026-W23');
		expect(result?.tasks).toEqual([{ date: '2026-06-02', kind: 'planned', text: '追蹤後續 [[✅ P-2026 範例：已完成專案]]', done: false }]);
	});

	it('defaults the end date to the year of today (2026-10-25 -> 2026-12-31)', () => {
		const text = '---\n開始日期: 2026-01-01\n---\n';
		const result = scanProjectNote(
			{ filename: '🚧 P-測試.md', text, path: 'x.md' },
			{ overrides: {}, today: '2026-10-25' },
		);
		expect(result?.end).toBe('2026-12-31');
		expect(result?.warnings).toContain('迄日預設為 2026-12-31');
	});

	it('derives the default end date from a today in the following year', () => {
		const text = '---\n開始日期: 2026-01-01\n---\n';
		const result = scanProjectNote(
			{ filename: '🚧 P-測試.md', text, path: 'x.md' },
			{ overrides: {}, today: '2027-01-05' },
		);
		expect(result?.end).toBe('2027-12-31');
		expect(result?.warnings).toContain('迄日預設為 2027-12-31');
	});

	it('sets overflow_end when a promised task date passes end, unless the project is closed', () => {
		const active = scanProjectNote(
			{
				filename: '🚧 P-20260101 ~ 1101 測試.md',
				text: '- [ ] 延後任務 📅 2026-11-15',
				path: 'x.md',
			},
			{ overrides: {}, today: '2026-10-25' },
		);
		expect(active?.overflow_end).toBe('2026-11-15');

		const done = scanProjectNote(
			{
				filename: '✅ P-20260101 ~ 1101 測試.md',
				text: '- [x] 延後任務 📅 2026-11-15 ✅ 2026-11-16',
				path: 'x.md',
			},
			{ overrides: {}, today: '2026-10-25' },
		);
		expect(done?.overflow_end).toBeNull();
	});

	it('reports missing start/end warnings when nothing can be derived', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-範例專案.md', text: '', path: 'x.md' },
			{ overrides: {}, today: '2026-10-25' },
		);
		expect(result?.start).toBeNull();
		expect(result?.warnings).toContain('缺開始日期');
	});

	it('adds task_lines without changing any field that existed before it', () => {
		const filename = '🚧 P-20260101 ~ 1231 測試.md';
		const text = '- [ ] 確認拍攝服裝 📅 2026-10-30\n- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15';
		const result = scanProjectNote({ filename, text, path: 'x.md' }, { overrides: {}, today });

		// Every non-task_lines field is recomputed here from the same unchanged
		// helper functions the other tests in this file exercise directly, so a
		// mismatch would mean scanProjectNote started computing that field
		// differently rather than just gaining task_lines.
		const expectedTaskDates = Array.from(new Set(parseTaskDates(text))).sort();
		const expectedTasks = parseTasks(text);
		const expectedOccupied = computeOccupiedWeeks(expectedTaskDates);
		const expectedNotDone = expectedTasks.filter((t) => !t.done).map((t) => t.date);
		const expectedOutstanding = new Set(computeOccupiedWeeks(expectedNotDone));
		const expectedSettled = expectedOccupied.filter((w) => !expectedOutstanding.has(w));

		const { task_lines: taskLines, ...rest } = result!;
		expect(rest).toEqual({
			name: 'P-20260101 ~ 1231 測試',
			category: 'other',
			color: rest.color,
			status: 'active',
			start: '2026-01-01',
			end: '2026-12-31',
			promised_end: expectedTaskDates.at(-1)!,
			overflow_end: null,
			task_dates: expectedTaskDates,
			tasks: expectedTasks,
			occupied_weeks: expectedOccupied,
			settled_weeks: expectedSettled,
			warnings: ['起日由檔名推得', '迄日由檔名推得'],
			path: 'x.md',
		});
		expect(taskLines.map((l) => l.line)).toEqual([0, 1]);
	});
});

describe('scanProjectFolder', () => {
	it('sorts by filename in code-point order before scanning', () => {
		const ctx = { overrides: {}, today: '2026-10-25' };
		const files = [
			{ filename: '🚧 P-B.md', text: '', path: 'b.md' },
			{ filename: '🚧 P-A.md', text: '', path: 'a.md' },
			{ filename: '🚧 P-＠.md', text: '', path: 'at.md' },
		];
		const result = scanProjectFolder(files, ctx);
		expect(result.map((r) => r.name)).toEqual(['P-A', 'P-B', 'P-＠']);
	});

	it('omits excluded projects from the scanned folder', () => {
		const ctx = { overrides: {}, today: '2026-10-25' };
		const files = [
			{ filename: '🚧 P-內部測試用專案.md', text: '', path: 'x.md' },
			{ filename: '🚧 P-A.md', text: '', path: 'a.md' },
		];
		const result = scanProjectFolder(files, ctx);
		expect(result.map((r) => r.name)).toEqual(['P-A']);
	});
});
