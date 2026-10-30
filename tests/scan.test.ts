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
import { defaultSettings, type ClassificationRule, type DashboardSettings } from '../src/core/settings';

// 兩種週六規則：預設（關）與開啟。開啟是維護者目前在用的值。
const SAT_OFF = { saturdayCountsAsNextWeek: false };
const SAT_ON = { saturdayCountsAsNextWeek: true };

function settingsWith(partial: Partial<DashboardSettings>): DashboardSettings {
	return { ...defaultSettings(), ...partial };
}

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
	const defaultRules = defaultSettings().classificationRules;

	it('applies a full-name override with the highest priority', () => {
		const overrides = { 'P-2026 範例：家庭生活專案 @小明 @小美': 'life' };
		expect(classify('P-2026 範例：家庭生活專案 @小明 @小美', overrides, defaultRules)).toBe('life');
	});

	it('does not apply an override to a different project name', () => {
		const overrides = { 'P-2026 範例：家庭生活專案 @小明 @小美': 'life' };
		expect(classify('P-2026 其他專案', overrides, defaultRules)).toBe('other');
	});

	it('ignores an override whose category is not a known key', () => {
		expect(classify('P-2026 範例專案 A', { 'P-2026 範例專案 A': 'unknown' }, defaultRules)).toBe('other');
	});

	// Example: rule order（dashboard-category-override），一列一個測試。
	it.each<[string, ClassificationRule[], string]>([
		['內訓 then 課程', [{ text: '內訓', category: 'corporate' }, { text: '課程', category: 'online_course' }], 'corporate'],
		['課程 then 內訓', [{ text: '課程', category: 'online_course' }, { text: '內訓', category: 'corporate' }], 'online_course'],
		['empty text then 內訓', [{ text: '', category: 'life' }, { text: '內訓', category: 'corporate' }], 'corporate'],
		['出版 only', [{ text: '出版', category: 'publishing' }], 'other'],
		['no rules', [], 'other'],
	])('rule order (%s) -> %s', (_name, rules, expected) => {
		expect(classify('P-2026 範例內訓課程', {}, rules)).toBe(expected);
	});

	it('classifies with the default rules', () => {
		expect(classify('P-2026 線上課程製作', {}, defaultRules)).toBe('online_course');
		expect(classify('P-2026 隨便一個名字', {}, defaultRules)).toBe('other');
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
	it('maps a Friday to its own ISO week under both settings', () => {
		expect(computeOccupiedWeeks(['2026-10-30'], SAT_OFF)).toEqual(['2026-W44']);
		expect(computeOccupiedWeeks(['2026-10-30'], SAT_ON)).toEqual(['2026-W44']);
	});

	it('rolls a Saturday into the following week only when the setting is on', () => {
		expect(computeOccupiedWeeks(['2026-10-31'], SAT_ON)).toEqual(['2026-W45']);
		expect(computeOccupiedWeeks(['2026-10-31'], SAT_OFF)).toEqual(['2026-W44']);
	});

	it('maps a Sunday to its own week', () => {
		expect(computeOccupiedWeeks(['2026-11-01'], SAT_ON)).toEqual(['2026-W44']);
	});

	it('dedupes and sorts labels', () => {
		expect(computeOccupiedWeeks(['2026-10-30', '2026-05-14', '2026-10-30'], SAT_ON)).toEqual(['2026-W20', '2026-W44']);
	});

	it('ignores unparseable dates', () => {
		expect(computeOccupiedWeeks(['not-a-date'], SAT_ON)).toEqual([]);
	});
});

describe('scanProjectNote', () => {
	const today = '2026-10-25';

	it('returns null for a project the 不列入的專案 setting excludes', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-2026 範例草稿.md', text: '', path: 'x.md' },
			{ overrides: {}, today, settings: settingsWith({ excludedProjects: ['範例草稿'] }) },
		);
		expect(result).toBeNull();
	});

	it('keeps the project when the exclusion list is empty', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-2026 範例草稿.md', text: '', path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.name).toBe('P-2026 範例草稿');
	});

	it('matches the spec example: filename-derived dates with life category', () => {
		const result = scanProjectNote(
			{
				filename: '🚧 P-20260413 ~ 1213 範例：家庭生活專案.md',
				text: '',
				path: 'x.md',
			},
			{ overrides: {}, today, settings: defaultSettings() },
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
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.status).toBe('done');
		expect(result?.category).toBe('other');
	});

	it('matches the spec example: planned task occupies W44', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 確認拍攝服裝 📅 2026-10-30', path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.tasks).toEqual([{ date: '2026-10-30', kind: 'planned', text: '確認拍攝服裝', done: false }]);
		expect(result?.occupied_weeks).toContain('2026-W44');
	});

	it('matches the spec example: a Saturday task stays in W44 with the default (off) setting', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 盤點 📅 2026-10-31', path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.occupied_weeks).toEqual(['2026-W44']);
		expect(result?.promised_end).toBe('2026-10-31');
	});

	it('matches the spec example: a Saturday task occupies W45 when the setting is on', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 盤點 📅 2026-10-31', path: 'x.md' },
			{ overrides: {}, today, settings: settingsWith({ saturdayCountsAsNextWeek: true }) },
		);
		expect(result?.occupied_weeks).toEqual(['2026-W45']);
		// promised_end 用原始日期，不是被推到下一週的日期。
		expect(result?.promised_end).toBe('2026-10-31');
	});

	it('matches the spec example: 2026-02-21 (Saturday, W8) bumps to W09 only with the setting on', () => {
		const text = '- [ ] 盤點 📅 2026-02-21';
		const on = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text, path: 'x.md' },
			{ overrides: {}, today, settings: settingsWith({ saturdayCountsAsNextWeek: true }) },
		);
		expect(on?.occupied_weeks).toEqual(['2026-W09']);
		expect(on?.promised_end).toBe('2026-02-21');

		const off = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text, path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(off?.occupied_weeks).toEqual(['2026-W08']);
	});

	it('matches the spec example: a comprehensive multi-date project under both settings', () => {
		const text = [
			'- [ ] 開工 📅 2026-01-12',
			'- [ ] 盤點 📅 2026-02-21',
			'- [ ] 校稿 📅 2026-03-13',
			'- [ ] 交付 📅 2026-05-15',
		].join('\n');
		const input = { filename: '🚧 P-20260101 ~ 1231 測試.md', text, path: 'x.md' };

		const on = scanProjectNote(input, {
			overrides: {},
			today,
			settings: settingsWith({ saturdayCountsAsNextWeek: true }),
		});
		expect(on?.occupied_weeks).toEqual(['2026-W03', '2026-W09', '2026-W11', '2026-W20']);
		expect(on?.promised_end).toBe('2026-05-15');

		const off = scanProjectNote(input, { overrides: {}, today, settings: defaultSettings() });
		expect(off?.occupied_weeks).toEqual(['2026-W03', '2026-W08', '2026-W11', '2026-W20']);
		expect(off?.promised_end).toBe('2026-05-15');
	});

	it('gives an empty occupied_weeks to a note with no task dates', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '沒有任務', path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.occupied_weeks).toEqual([]);
	});

	it('maps a Monday task to its ISO week', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 開工 📅 2026-01-12', path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.occupied_weeks).toEqual(['2026-W03']);
	});

	it('dedupes two tasks that fall in the same week', () => {
		const text = '- [ ] 開工 📅 2026-01-12\n- [ ] 續做 📅 2026-01-14';
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text, path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.occupied_weeks).toEqual(['2026-W03']);
	});

	it('applies an exact-name override and leaves a fragment-sharing project alone', () => {
		const overrides = { 'P-2026 範例：家庭生活專案 @小明 @小美': 'life' };
		const overridden = scanProjectNote(
			{ filename: '🚧 P-2026 範例：家庭生活專案 @小明 @小美.md', text: '', path: 'a.md' },
			{ overrides, today, settings: settingsWith({ classificationRules: [{ text: '家庭生活專案', category: 'corporate' }] }) },
		);
		expect(overridden?.category).toBe('life');

		const other = scanProjectNote(
			{ filename: '🚧 P-2026 另一個家庭生活專案.md', text: '', path: 'b.md' },
			{ overrides, today, settings: settingsWith({ classificationRules: [{ text: '家庭生活專案', category: 'corporate' }] }) },
		);
		expect(other?.category).toBe('corporate');
	});

	it('matches the spec example: Friday task sets promised_end and occupies its own week', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-20260101 ~ 1231 測試.md', text: '- [ ] 盤點 📅 2026-05-15', path: 'x.md' },
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.promised_end).toBe('2026-05-15');
		expect(result?.occupied_weeks).toEqual(['2026-W20']);
	});

	it('matches the spec example: both dates of a done task settle when uncontested', () => {
		const result = scanProjectNote(
			{
				filename: '🚧 P-20260101 ~ 1231 測試.md',
				text: '- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15',
				path: 'x.md',
			},
			{ overrides: {}, today, settings: defaultSettings() },
		);
		const plannedWeek = computeOccupiedWeeks(['2026-05-14'], SAT_OFF)[0];
		const doneWeek = computeOccupiedWeeks(['2026-05-15'], SAT_OFF)[0];
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
			{ overrides: {}, today, settings: defaultSettings() },
		);
		expect(result?.occupied_weeks).toContain('2026-W23');
		expect(result?.settled_weeks).not.toContain('2026-W23');
		expect(result?.tasks).toEqual([{ date: '2026-06-02', kind: 'planned', text: '追蹤後續 [[✅ P-2026 範例：已完成專案]]', done: false }]);
	});

	it('defaults the end date to the year of today (2026-10-25 -> 2026-12-31)', () => {
		const text = '---\n開始日期: 2026-01-01\n---\n';
		const result = scanProjectNote(
			{ filename: '🚧 P-測試.md', text, path: 'x.md' },
			{ overrides: {}, today: '2026-10-25', settings: defaultSettings() },
		);
		expect(result?.end).toBe('2026-12-31');
		expect(result?.warnings).toContain('迄日預設為 2026-12-31');
	});

	it('derives the default end date from a today in the following year', () => {
		const text = '---\n開始日期: 2026-01-01\n---\n';
		const result = scanProjectNote(
			{ filename: '🚧 P-測試.md', text, path: 'x.md' },
			{ overrides: {}, today: '2027-01-05', settings: defaultSettings() },
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
			{ overrides: {}, today: '2026-10-25', settings: defaultSettings() },
		);
		expect(active?.overflow_end).toBe('2026-11-15');

		const done = scanProjectNote(
			{
				filename: '✅ P-20260101 ~ 1101 測試.md',
				text: '- [x] 延後任務 📅 2026-11-15 ✅ 2026-11-16',
				path: 'x.md',
			},
			{ overrides: {}, today: '2026-10-25', settings: defaultSettings() },
		);
		expect(done?.overflow_end).toBeNull();
	});

	it('reports missing start/end warnings when nothing can be derived', () => {
		const result = scanProjectNote(
			{ filename: '🚧 P-範例專案.md', text: '', path: 'x.md' },
			{ overrides: {}, today: '2026-10-25', settings: defaultSettings() },
		);
		expect(result?.start).toBeNull();
		expect(result?.warnings).toContain('缺開始日期');
	});

	it('adds task_lines without changing any field that existed before it', () => {
		const filename = '🚧 P-20260101 ~ 1231 測試.md';
		const text = '- [ ] 確認拍攝服裝 📅 2026-10-30\n- [x] 寄出提案 📅 2026-05-14 ✅ 2026-05-15';
		const result = scanProjectNote({ filename, text, path: 'x.md' }, { overrides: {}, today, settings: defaultSettings() });

		// Every non-task_lines field is recomputed here from the same unchanged
		// helper functions the other tests in this file exercise directly, so a
		// mismatch would mean scanProjectNote started computing that field
		// differently rather than just gaining task_lines.
		const expectedTaskDates = Array.from(new Set(parseTaskDates(text))).sort();
		const expectedTasks = parseTasks(text);
		const expectedOccupied = computeOccupiedWeeks(expectedTaskDates, defaultSettings());
		const expectedNotDone = expectedTasks.filter((t) => !t.done).map((t) => t.date);
		const expectedOutstanding = new Set(computeOccupiedWeeks(expectedNotDone, defaultSettings()));
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
		const ctx = { overrides: {}, today: '2026-10-25', settings: defaultSettings() };
		const files = [
			{ filename: '🚧 P-B.md', text: '', path: 'b.md' },
			{ filename: '🚧 P-A.md', text: '', path: 'a.md' },
			{ filename: '🚧 P-＠.md', text: '', path: 'at.md' },
		];
		const result = scanProjectFolder(files, ctx);
		expect(result.map((r) => r.name)).toEqual(['P-A', 'P-B', 'P-＠']);
	});

	// Scenario: Excluded project is omitted（dashboard-obsidian-plugin）。
	it('omits excluded projects from the scanned folder', () => {
		const ctx = {
			overrides: {},
			today: '2026-10-25',
			settings: settingsWith({ excludedProjects: ['範例草稿'] }),
		};
		const files = [
			{ filename: '🚧 P-2026 範例草稿.md', text: '', path: 'x.md' },
			{ filename: '🚧 P-2026 範例專案 A.md', text: '', path: 'a.md' },
		];
		const result = scanProjectFolder(files, ctx);
		expect(result.map((r) => r.name)).toEqual(['P-2026 範例專案 A']);
	});
});
