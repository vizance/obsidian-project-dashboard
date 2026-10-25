import { describe, expect, it } from 'vitest';
import {
	applyCategoryOverride,
	clampProjColWidth,
	parseCategoryOrder,
	parsePinnedCategory,
	parseProjColWidth,
	parseViewMode,
	resolveInitialHelpPanel,
} from '../src/core/prefs';

const CATEGORY_KEYS = ['corporate', 'online_course', 'coaching', 'publishing', 'sponsorship', 'life', 'other'];

describe('stored value handling', () => {
	it("dashboard.projColWidth = '50' clamps to 120", () => {
		expect(parseProjColWidth('50')).toBe(120);
	});

	it("dashboard.projColWidth = 'abc' defaults to 280", () => {
		expect(parseProjColWidth('abc')).toBe(280);
	});

	it('dashboard.categoryOrder reorders stored keys and appends missing ones', () => {
		expect(parseCategoryOrder('["publishing","unknown_cat","corporate"]', CATEGORY_KEYS)).toEqual([
			'publishing',
			'corporate',
			'online_course',
			'coaching',
			'sponsorship',
			'life',
			'other',
		]);
	});

	it("dashboard.pinnedCategory = '\"unknown_cat\"' resolves to null", () => {
		expect(parsePinnedCategory('"unknown_cat"', CATEGORY_KEYS)).toBeNull();
	});

	it('dashboard.viewMode absent defaults to per-week', () => {
		expect(parseViewMode(null)).toBe('per-week');
	});
});

describe('clampProjColWidth', () => {
	it('clamps above max', () => {
		expect(clampProjColWidth(1000)).toBe(600);
	});
});

describe('applyCategoryOverride', () => {
	it('writes a valid category key', () => {
		const result = applyCategoryOverride({}, 'P-1', 'life', CATEGORY_KEYS);
		expect(result).toEqual({ ok: true, overrides: { 'P-1': 'life' } });
	});

	it('deletes the entry when category is null', () => {
		const original = { 'P-1': 'life' };
		const result = applyCategoryOverride(original, 'P-1', null, CATEGORY_KEYS);
		expect(result).toEqual({ ok: true, overrides: {} });
		expect(original).toEqual({ 'P-1': 'life' });
	});

	it('rejects an unknown category key and leaves overrides untouched', () => {
		const original = { 'P-1': 'life' };
		const result = applyCategoryOverride(original, 'P-1', 'not_a_category', CATEGORY_KEYS);
		expect(result.ok).toBe(false);
		expect(result.overrides).toBe(original);
	});
});

describe('resolveInitialHelpPanel', () => {
	it('shows the panel and marks first-seen on the first launch', () => {
		expect(resolveInitialHelpPanel(null, null)).toEqual({ visible: true, markFirstSeen: true });
	});

	it('reuses the stored open state after the first launch', () => {
		expect(resolveInitialHelpPanel('true', 'false')).toEqual({ visible: false, markFirstSeen: false });
		expect(resolveInitialHelpPanel('true', 'true')).toEqual({ visible: true, markFirstSeen: false });
	});
});
