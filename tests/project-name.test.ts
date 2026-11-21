import { describe, expect, it } from 'vitest';
import { shortProjectName } from '../src/core/project-name';

describe('shortProjectName', () => {
	it.each([
		{ input: 'P-20260302 範例企業內訓規劃', expected: '範例企業內訓規劃' },
		{ input: 'P-2026 範例年度計畫', expected: '範例年度計畫' },
		{ input: 'P-202606 範例專案', expected: '範例專案' },
		{ input: 'P-2026Q1 範例專案', expected: '範例專案' },
		{ input: 'P-2027.01 ~ 2027.04 範例專案', expected: '範例專案' },
		{ input: 'P-20261102 ~ 1218 範例專案', expected: '範例專案' },
		{ input: 'P-20261102 ～ 1218 範例專案', expected: '範例專案' },
		{ input: 'P-2025 ~ 2026 範例專案', expected: '範例專案' },
		{ input: 'P-20261112 ~ 20270131 範例專案', expected: '範例專案' },
		{ input: 'P-20260716 & 20260730 範例專案', expected: '範例專案' },
		{ input: 'P-20260507 & 0521 & 0604 範例讀書會', expected: '範例讀書會' },
		{ input: 'P-20260302 Example Workshop', expected: 'Example Workshop' },
		{ input: 'P-2026 (範例) 專案', expected: '(範例) 專案' },
		{ input: 'P-2026 12 個月計畫', expected: '12 個月計畫' },
		{ input: 'P-20260302  範例專案', expected: '範例專案' },
	])('drops the date code from "$input"', ({ input, expected }) => {
		expect(shortProjectName(input)).toBe(expected);
	});

	it.each([
		'範例專案',
		'P-範例專案',
		'P-Example 1 範例',
		'P-20260302',
		'P-20260302 ~ 1218',
		'P-2026-範例',
		'p-20260302 範例',
		'Q-20260302 範例',
		'2026 範例',
		'P-202 範例',
	])('returns "%s" unchanged', (input) => {
		expect(shortProjectName(input)).toBe(input);
	});
});
