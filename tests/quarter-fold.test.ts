import { describe, expect, it } from 'vitest';
import * as quarterFold from '../src/core/quarter-fold';
import { buildWeeks, todayWeekIndex, type WeekInfo } from '../src/core/weeks';

// 模組在下一階段才新增；先鎖定設計簽名，避免缺少型別衍生出無關的 lint 錯誤。
interface QuarterFoldContract {
	quarterOfWeek: (week: WeekInfo) => number;
	defaultFoldedQuarters: (weeks: WeekInfo[], todayIdx: number) => number[];
	yearColumns: (weeks: WeekInfo[], folded: ReadonlySet<number>) => Array<
		{ kind: 'weeks'; start: number; end: number } | { kind: 'fold'; quarter: number }
	>;
	centeredScrollLeft: (input: {
		scrollLeft: number;
		columnLeft: number;
		columnRight: number;
		areaLeft: number;
		areaRight: number;
		maxScrollLeft: number;
	}) => number;
	columnFullyVisible: (column: { left: number; right: number }, area: { left: number; right: number }) => boolean;
}
// 指派給介面型別：模組的簽名對不上設計時，型別檢查就會失敗。
const contract: QuarterFoldContract = quarterFold;
const { quarterOfWeek, defaultFoldedQuarters, yearColumns, centeredScrollLeft, columnFullyVisible } = contract;

const weeks = buildWeeks(2026);
const indexOf = (week: number): number => weeks.findIndex((entry) => entry.week === week);

// 2026 年 W14、W27、W40 的週一仍在前一季；依既有月份規則鎖定分界，避免改動月視圖。
describe('quarterOfWeek', () => {
	it.each([[1, 1], [13, 1], [14, 1], [15, 2], [27, 2], [28, 3], [40, 3], [41, 4], [53, 4]])('assigns 2026-W%s to Q%s', (week, quarter) => {
		expect(quarterOfWeek(weeks[indexOf(week)]!)).toBe(quarter);
	});
});

describe('defaultFoldedQuarters', () => {
	it.each([
		['2026-11-20', [1, 2, 3]],
		['2026-01-15', []],
		['2026-05-20', [1]],
	] as const)('folds only past quarters on %s', (today, folded) => {
		expect(defaultFoldedQuarters(weeks, todayWeekIndex(weeks, today))).toEqual(folded);
	});
	it('keeps all quarters expanded when todayIdx is -1', () => {
		expect(defaultFoldedQuarters(weeks, -1)).toEqual([]);
	});
});

describe('yearColumns', () => {
	it('separates expanded runs with folded Q1 and Q3', () => {
		expect(yearColumns(weeks, new Set([1, 3]))).toEqual([
			{ kind: 'fold', quarter: 1 },
			{ kind: 'weeks', start: indexOf(15), end: indexOf(28) },
			{ kind: 'fold', quarter: 3 },
			{ kind: 'weeks', start: indexOf(41), end: 53 },
		]);
	});
	it('merges all expanded quarters into one run', () => {
		expect(yearColumns(weeks, new Set())).toEqual([{ kind: 'weeks', start: 0, end: 53 }]);
	});
	it('merges W1 through W40 before folded Q4', () => {
		expect(yearColumns(weeks, new Set([4]))).toEqual([
			{ kind: 'weeks', start: 0, end: indexOf(41) }, { kind: 'fold', quarter: 4 },
		]);
	});
	it('represents all folded quarters as four narrow columns', () => {
		expect(yearColumns(weeks, new Set([1, 2, 3, 4]))).toEqual([
			{ kind: 'fold', quarter: 1 }, { kind: 'fold', quarter: 2 },
			{ kind: 'fold', quarter: 3 }, { kind: 'fold', quarter: 4 },
		]);
	});
});

describe('centeredScrollLeft', () => {
	it.each([
		{ label: 'clamps to maxScrollLeft', scrollLeft: 0, columnLeft: 1752, columnRight: 1784, maxScrollLeft: 1000, expected: 1000 },
		{ label: 'clamps to zero', scrollLeft: 0, columnLeft: 600, columnRight: 632, maxScrollLeft: 1000, expected: 0 },
		{ label: 'includes the existing scroll offset', scrollLeft: 100, columnLeft: 900, columnRight: 932, maxScrollLeft: 2000, expected: 326 },
		{ label: 'rounds to an integer', scrollLeft: 100, columnLeft: 900.6, columnRight: 932.6, maxScrollLeft: 2000, expected: 327 },
	])('$label', ({ expected, label: _label, ...input }) => {
		const result = centeredScrollLeft({ ...input, areaLeft: 280, areaRight: 1100 });
		expect(result).toBe(expected);
		expect(Number.isInteger(result)).toBe(true);
	});
});

describe('columnFullyVisible', () => {
	it.each([
		{ label: 'touching both edges', left: 280, right: 1100, expected: true },
		{ label: 'inside the area', left: 600, right: 632, expected: true },
		{ label: 'one pixel beyond the left edge', left: 279, right: 311, expected: true },
		{ label: 'one pixel beyond the right edge', left: 1069, right: 1101, expected: true },
		{ label: 'half a pixel beyond both edges', left: 279.5, right: 1100.5, expected: true },
		{ label: '1.5 pixels beyond the left edge', left: 278.5, right: 310.5, expected: false },
		{ label: '1.5 pixels beyond the right edge', left: 1069.5, right: 1101.5, expected: false },
	])('$label', ({ left, right, expected }) => {
		expect(columnFullyVisible({ left, right }, { left: 280, right: 1100 })).toBe(expected);
	});
});
