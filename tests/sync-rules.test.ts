import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncer, isProjectNotePath, isRelevantChange } from '../src/core/sync-rules';

const FOLDER = 'Projects';

describe('isProjectNotePath', () => {
	it('is true for a direct child markdown note', () => {
		expect(isProjectNotePath(`${FOLDER}/🚧 P-2026 some project.md`, FOLDER)).toBe(true);
	});

	it('is false for a note under a subfolder', () => {
		expect(
			isProjectNotePath(`${FOLDER}/Task 任務筆記/x.md`, FOLDER),
		).toBe(false);
	});

	it('is false for a note outside the project folder', () => {
		expect(
			isProjectNotePath('Calendar/Journal/Daily notes/2026-10-25 daily note.md', FOLDER),
		).toBe(false);
	});
});

describe('isRelevantChange', () => {
	it('is true when a rename moves a note from inside to outside the folder', () => {
		expect(
			isRelevantChange('Archive/old.md', `${FOLDER}/old.md`, FOLDER),
		).toBe(true);
	});

	it('is false when neither path qualifies', () => {
		expect(isRelevantChange('Archive/old.md', 'Archive/older.md', FOLDER)).toBe(false);
	});
});

describe('createDebouncer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function makeTimers() {
		return {
			set: (fn: () => void, ms: number) => setTimeout(fn, ms) as unknown as number,
			clear: (id: number) => clearTimeout(id),
		};
	}

	it('collapses a single event into one re-scan at 400ms', () => {
		const fn = vi.fn();
		const debouncer = createDebouncer(400, makeTimers(), fn);
		debouncer.trigger();
		vi.advanceTimersByTime(400);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('collapses a burst of events (0,100,250,380,500) into one re-scan at 900ms', () => {
		const fn = vi.fn();
		const debouncer = createDebouncer(400, makeTimers(), fn);
		const offsets = [0, 100, 250, 380, 500];
		const calledAt: number[] = [];
		fn.mockImplementation(() => calledAt.push(Date.now()));
		const start = Date.now();
		let elapsed = 0;
		for (const offset of offsets) {
			vi.advanceTimersByTime(offset - elapsed);
			elapsed = offset;
			debouncer.trigger();
		}
		vi.advanceTimersByTime(1000);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(calledAt).toEqual([start + 900]);
	});

	it('produces two re-scans for events at 0 and 600, at 400 and 1000', () => {
		const fn = vi.fn();
		const debouncer = createDebouncer(400, makeTimers(), fn);
		const calledAt: number[] = [];
		fn.mockImplementation(() => calledAt.push(Date.now()));
		const start = Date.now();
		debouncer.trigger();
		vi.advanceTimersByTime(600);
		debouncer.trigger();
		vi.advanceTimersByTime(1000);
		expect(fn).toHaveBeenCalledTimes(2);
		expect(calledAt).toEqual([start + 400, start + 1000]);
	});
});
