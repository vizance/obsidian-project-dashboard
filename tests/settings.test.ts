import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CLASSIFICATION_RULES,
	defaultSettings,
	normalizePluginData,
	normalizeSettings,
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
