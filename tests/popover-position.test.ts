import { describe, expect, it } from 'vitest';
import { placePopover, type PopoverPlacementInput, type PopoverRect } from '../src/core/popover-position';

// 一個典型的版面：1600×900 視窗，儀表板分頁佔左邊 300–1200（右邊開著筆記）。
const VIEWPORT = { width: 1600, height: 900 };
const PANE: PopoverRect = { left: 300, top: 0, right: 1200, bottom: 900 };
const SIZE = { width: 320, height: 200 };

function cell(left: number, top: number, width = 40, height = 24): PopoverRect {
	return { left, top, right: left + width, bottom: top + height };
}

function place(overrides: Partial<PopoverPlacementInput> = {}): { left: number; top: number } {
	return placePopover({
		anchor: cell(400, 300),
		size: SIZE,
		pane: PANE,
		viewport: VIEWPORT,
		...overrides,
	});
}

describe('week popover placement', () => {
	it('places the popover below the cell at the cell’s left edge when it fits', () => {
		expect(place()).toEqual({ left: 400, top: 330 });
	});

	it('flips to the cell’s right edge when it would cross the pane’s right edge', () => {
		// 格子 1100–1140：往右放會超出分頁右緣 1200，改成右緣對齊格子右緣。
		expect(place({ anchor: cell(1100, 300) })).toEqual({ left: 820, top: 330 });
	});

	it('clamps inside the pane when even the flipped position would overflow the pane’s left edge', () => {
		expect(place({ anchor: cell(310, 300) }).left).toBe(310);
		expect(place({ anchor: cell(1190, 300) }).left).toBe(876);
	});

	it('falls back to the viewport when the pane is narrower than the popover', () => {
		// 分頁只有 1200–1500（300px）放不下 320px 的浮窗：改用整個視窗的邊界，
		// 所以不會因為超出分頁右緣就往左翻。
		const narrow: PopoverRect = { left: 1200, top: 0, right: 1500, bottom: 900 };
		expect(place({ anchor: cell(1250, 300), pane: narrow })).toEqual({ left: 1250, top: 330 });
	});

	it('flips above the cell when it would cross the bottom edge', () => {
		expect(place({ anchor: cell(400, 800) })).toEqual({ left: 400, top: 594 });
	});

	it('never returns a negative coordinate', () => {
		const tiny = { width: 200, height: 200 };
		const result = placePopover({
			anchor: cell(0, 0),
			size: tiny,
			pane: { left: -50, top: -50, right: 100, bottom: 100 },
			viewport: { width: 150, height: 150 },
		});
		expect(result.left).toBeGreaterThanOrEqual(0);
		expect(result.top).toBeGreaterThanOrEqual(0);
	});
});
