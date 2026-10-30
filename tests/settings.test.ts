import { describe, expect, it } from 'vitest';
import { classify } from '../src/core/scan';
import {
	addClassificationRule,
	DEFAULT_CLASSIFICATION_RULES,
	defaultSettings,
	moveClassificationRule,
	normalizePluginData,
	normalizeSettings,
	removeClassificationRule,
	replaceClassificationRule,
	weekdayFromOption,
	type ClassificationRule,
} from '../src/core/settings';

const TEN_DEFAULT_RULES = [
	{ text: '企業內訓', category: 'corporate' },
	{ text: '內訓', category: 'corporate' },
	{ text: '線上課程', category: 'online_course' },
	{ text: '課程', category: 'online_course' },
	{ text: '出版', category: 'publishing' },
	{ text: '教練', category: 'coaching' },
	{ text: '諮詢', category: 'coaching' },
	{ text: '業配', category: 'sponsorship' },
	{ text: '合作', category: 'sponsorship' },
	{ text: '生活', category: 'life' },
];

describe('defaultSettings', () => {
	it('lists the ten default classification rules in the spec order', () => {
		expect(defaultSettings().classificationRules).toEqual(TEN_DEFAULT_RULES);
		expect(DEFAULT_CLASSIFICATION_RULES).toEqual(TEN_DEFAULT_RULES);
	});
});

describe('normalizePluginData', () => {
	// Scenario: First run uses the defaults.
	it('uses the defaults when the plugin data has no settings key', () => {
		const data = normalizePluginData({ categoryOverrides: { 'P-2026 範例專案 A': 'life' } });
		expect(data.settings).toEqual({
			projectFolder: 'Projects',
			classificationRules: TEN_DEFAULT_RULES,
			excludedProjects: [],
			scheduleWeekday: 5,
			saturdayCountsAsNextWeek: false,
		});
		expect(data.categoryOverrides).toEqual({ 'P-2026 範例專案 A': 'life' });
	});

	it('uses the defaults when there is no plugin data at all', () => {
		expect(normalizePluginData(null)).toEqual({ categoryOverrides: {}, settings: defaultSettings() });
		expect(normalizePluginData(undefined)).toEqual({ categoryOverrides: {}, settings: defaultSettings() });
	});

	it('keeps only a plain object whose values are all strings as the overrides', () => {
		expect(normalizePluginData({ categoryOverrides: { a: 'life', b: 3 } }).categoryOverrides).toEqual({});
		expect(normalizePluginData({ categoryOverrides: ['life'] }).categoryOverrides).toEqual({});
		expect(normalizePluginData({ categoryOverrides: 'life' }).categoryOverrides).toEqual({});
	});

	it('normalizes the settings and the overrides independently of each other', () => {
		const data = normalizePluginData({ categoryOverrides: 3, settings: { projectFolder: 'Work/Projects' } });
		expect(data.categoryOverrides).toEqual({});
		expect(data.settings.projectFolder).toBe('Work/Projects');
	});
});

// Example: field normalization（dashboard-settings）：一列一個測試。
describe('normalizeSettings — field normalization', () => {
	it('trims the project folder and strips leading and trailing slashes', () => {
		expect(normalizeSettings({ projectFolder: '/Work/Projects/ ' }).projectFolder).toBe('Work/Projects');
	});

	it('falls back to Projects for an empty project folder', () => {
		expect(normalizeSettings({ projectFolder: '' }).projectFolder).toBe('Projects');
	});

	it('trims rule text, keeps empty text, and drops invalid entries', () => {
		const raw = {
			classificationRules: [
				{ text: ' 課程 ', category: 'online_course' },
				{ text: '', category: 'life' },
				{ text: '合作', category: 'unknown' },
				{ text: 3, category: 'life' },
			],
		};
		expect(normalizeSettings(raw).classificationRules).toEqual([
			{ text: '課程', category: 'online_course' },
			{ text: '', category: 'life' },
		]);
	});

	it('keeps an empty rule list empty instead of restoring the defaults', () => {
		expect(normalizeSettings({ classificationRules: [] }).classificationRules).toEqual([]);
	});

	it('restores the ten default rules when the rule list is not an array', () => {
		expect(normalizeSettings({ classificationRules: '課程' }).classificationRules).toEqual(TEN_DEFAULT_RULES);
	});

	it('trims the exclusion list and drops empty and non-string entries', () => {
		expect(normalizeSettings({ excludedProjects: [' 範例草稿 ', '', 3] }).excludedProjects).toEqual(['範例草稿']);
	});

	it('keeps a weekday inside 1–7', () => {
		expect(normalizeSettings({ scheduleWeekday: 6 }).scheduleWeekday).toBe(6);
	});

	it.each([
		['0', 0],
		['8', 8],
		['2.5', 2.5],
		['the string "5"', '5'],
	])('falls back to Friday for %s', (_label, value) => {
		expect(normalizeSettings({ scheduleWeekday: value }).scheduleWeekday).toBe(5);
	});

	it('falls back to false for a non-boolean Saturday rule', () => {
		expect(normalizeSettings({ saturdayCountsAsNextWeek: 'yes' }).saturdayCountsAsNextWeek).toBe(false);
	});

	it('keeps a boolean Saturday rule', () => {
		expect(normalizeSettings({ saturdayCountsAsNextWeek: true }).saturdayCountsAsNextWeek).toBe(true);
	});

	it('normalizes one broken field without discarding the others', () => {
		const settings = normalizeSettings({
			projectFolder: 'Work/Projects',
			classificationRules: 3,
			excludedProjects: ['範例草稿'],
			scheduleWeekday: 'nope',
			saturdayCountsAsNextWeek: true,
		});
		expect(settings).toEqual({
			projectFolder: 'Work/Projects',
			classificationRules: TEN_DEFAULT_RULES,
			excludedProjects: ['範例草稿'],
			scheduleWeekday: 5,
			saturdayCountsAsNextWeek: true,
		});
	});
});

describe('the returned settings never share arrays with the defaults', () => {
	it('does not let a mutated rule list change the next default', () => {
		const first = defaultSettings();
		first.classificationRules.push({ text: '別的', category: 'other' });
		first.classificationRules[0]!.text = '改掉了';
		first.excludedProjects.push('範例草稿');

		expect(defaultSettings().classificationRules).toEqual(TEN_DEFAULT_RULES);
		expect(defaultSettings().excludedProjects).toEqual([]);
		expect(DEFAULT_CLASSIFICATION_RULES).toEqual(TEN_DEFAULT_RULES);
	});

	it('does not let a mutated normalized result change the defaults', () => {
		const settings = normalizeSettings({});
		settings.classificationRules.length = 0;
		expect(normalizeSettings({}).classificationRules).toEqual(TEN_DEFAULT_RULES);
	});

	it('does not keep the caller’s override object as its own', () => {
		const overrides: Record<string, string> = { 'P-2026 範例專案 A': 'life' };
		const data = normalizePluginData({ categoryOverrides: overrides });
		overrides['P-2026 範例專案 B'] = 'other';
		expect(data.categoryOverrides).toEqual({ 'P-2026 範例專案 A': 'life' });
	});
});

// 設定頁用的純函式（task 2.3）：規則清單的新增、刪除、移動與星期幾選項轉換。
describe('classification rule list helpers', () => {
	const RULES: ClassificationRule[] = [
		{ text: '課程', category: 'online_course' },
		{ text: '內訓', category: 'corporate' },
		{ text: '出版', category: 'publishing' },
	];

	it('appends an empty rule with category other', () => {
		expect(addClassificationRule(RULES)).toEqual([...RULES, { text: '', category: 'other' }]);
	});

	it('removes the rule at the given index', () => {
		expect(removeClassificationRule(RULES, 1)).toEqual([RULES[0], RULES[2]]);
	});

	it('ignores a removal outside the list', () => {
		expect(removeClassificationRule(RULES, 3)).toEqual(RULES);
		expect(removeClassificationRule(RULES, -1)).toEqual(RULES);
	});

	it('moves a rule up and down', () => {
		expect(moveClassificationRule(RULES, 1, -1)).toEqual([RULES[1], RULES[0], RULES[2]]);
		expect(moveClassificationRule(RULES, 1, 1)).toEqual([RULES[0], RULES[2], RULES[1]]);
	});

	it('ignores a move that would leave the list', () => {
		expect(moveClassificationRule(RULES, 0, -1)).toEqual(RULES);
		expect(moveClassificationRule(RULES, 2, 1)).toEqual(RULES);
	});

	it('replaces only the edited field of one rule', () => {
		expect(replaceClassificationRule(RULES, 1, { text: '企業內訓' })).toEqual([
			RULES[0],
			{ text: '企業內訓', category: 'corporate' },
			RULES[2],
		]);
	});

	it('never changes the list it was given', () => {
		const original: ClassificationRule[] = [{ text: '課程', category: 'online_course' }];
		addClassificationRule(original);
		removeClassificationRule(original, 0);
		moveClassificationRule(original, 0, 1);
		replaceClassificationRule(original, 0, { text: '改掉了' });
		expect(original).toEqual([{ text: '課程', category: 'online_course' }]);
	});
});

// Scenario: Moving a rule up changes the result（dashboard-settings）。
describe('Moving a rule up changes the result', () => {
	it('classifies 範例內訓課程 as corporate after 內訓 moves above 課程', () => {
		const rules: ClassificationRule[] = [
			{ text: '課程', category: 'online_course' },
			{ text: '內訓', category: 'corporate' },
		];
		const name = 'P-2026 範例內訓課程';
		expect(classify(name, {}, rules)).toBe('online_course');

		const moved = normalizeSettings({ classificationRules: moveClassificationRule(rules, 1, -1) }).classificationRules;
		expect(moved).toEqual([
			{ text: '內訓', category: 'corporate' },
			{ text: '課程', category: 'online_course' },
		]);
		expect(classify(name, {}, moved)).toBe('corporate');
	});
});

// Scenario: A new empty rule survives a save（dashboard-settings）。
describe('A new empty rule survives a save', () => {
	it('keeps the empty rule as the last row and classifies exactly as before', () => {
		const before = defaultSettings().classificationRules;
		const added = addClassificationRule(before);

		// 存檔與重新載入都經過同一套檢查，空白的那一列仍在最後。
		const reloaded = normalizePluginData({ settings: { classificationRules: added } }).settings.classificationRules;
		expect(reloaded).toHaveLength(before.length + 1);
		expect(reloaded[reloaded.length - 1]).toEqual({ text: '', category: 'other' });

		for (const name of ['P-2026 範例內訓課程', 'P-2026 範例專案 A', 'P-2026 生活紀錄']) {
			expect(classify(name, {}, reloaded)).toBe(classify(name, {}, before));
		}
	});
});

// Scenario: Saturday is stored as a number（dashboard-settings）。
describe('weekdayFromOption', () => {
	it('turns the 星期六 option value into the integer 6', () => {
		const weekday = weekdayFromOption('6');
		expect(weekday).toBe(6);
		expect(normalizeSettings({ scheduleWeekday: weekday }).scheduleWeekday).toBe(6);
	});

	it.each([['1', 1], ['7', 7]] as const)('turns %s into %i', (value, expected) => {
		expect(weekdayFromOption(value)).toBe(expected);
	});

	it.each(['0', '8', '2.5', '', 'nope'])('falls back to Friday for "%s"', (value) => {
		expect(weekdayFromOption(value)).toBe(5);
	});
});

// Scenario: Emptied folder falls back to the default（dashboard-settings）。
describe('Emptied folder falls back to the default', () => {
	it('stores and scans with Projects when the field is cleared', () => {
		const settings = { ...defaultSettings(), projectFolder: '' };
		const stored = normalizePluginData({ settings }).settings;
		expect(stored.projectFolder).toBe('Projects');
		// 設定頁的 `Can't find this folder.` 也用這個檢查後的值判斷。
		expect(normalizeSettings(settings).projectFolder).toBe('Projects');
	});
});
