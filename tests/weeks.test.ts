import { describe, expect, it } from 'vitest';
import {
	addDaysISO,
	buildWeeks,
	mondayOfWeek,
	taskDateToWeekLabel,
	todayLocal,
	todayWeekIndex,
	weekRangeLabel,
} from '../src/core/weeks';

describe('buildWeeks', () => {
	it('covers W1 through W53 for 2026', () => {
		const weeks = buildWeeks(2026);
		expect(weeks.map((w) => w.label)[0]).toBe('2026-W01');
		expect(weeks.map((w) => w.label).at(-1)).toBe('2026-W53');
		expect(weeks).toHaveLength(53);
	});

	it('covers W1 through W52 for 2027', () => {
		const weeks = buildWeeks(2027);
		expect(weeks.map((w) => w.label)[0]).toBe('2027-W01');
		expect(weeks.map((w) => w.label).at(-1)).toBe('2027-W52');
		expect(weeks).toHaveLength(52);
	});
});

describe('todayLocal', () => {
	it('uses the local date, not the UTC date, for an early Taipei morning', () => {
		// 2026-10-25T23:30:00Z is 2026-10-26 07:30 in Asia/Taipei (TZ set in vitest.config.ts).
		expect(todayLocal(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
	});
});

describe('todayWeekIndex', () => {
	it('points at the W44 column for 2026-10-26', () => {
		const weeks = buildWeeks(2026);
		const idx = todayWeekIndex(weeks, '2026-10-26');
		expect(weeks[idx]!.label).toBe('2026-W44');
	});
});

describe('taskDateToWeekLabel', () => {
	it('keeps a weekday task in its own week', () => {
		expect(taskDateToWeekLabel('2026-10-30')).toEqual({ label: '2026-W44', isBumpedSat: false });
	});

	it('bumps a Saturday task to the following week', () => {
		expect(taskDateToWeekLabel('2026-10-31')).toEqual({ label: '2026-W45', isBumpedSat: true });
	});
});

describe('addDaysISO', () => {
	it('subtracts across a year boundary: 2026-01-02 - 7 -> 2025-12-26', () => {
		expect(addDaysISO('2026-01-02', -7)).toBe('2025-12-26');
	});

	it('adds days within a month', () => {
		expect(addDaysISO('2026-10-30', 7)).toBe('2026-11-06');
	});
});

describe('mondayOfWeek', () => {
	it("gives 2026-12-28 for 2026-W53's Monday", () => {
		expect(mondayOfWeek('2026-W53')).toBe('2026-12-28');
	});

	it('works for a label in a different year (2027-W01)', () => {
		expect(mondayOfWeek('2027-W01')).toBe('2027-01-04');
	});
});

describe('weekRangeLabel', () => {
	it('matches the spec example for W44', () => {
		expect(weekRangeLabel('2026-W44')).toBe('W44　10/26（一）– 11/1（日）');
	});
});
