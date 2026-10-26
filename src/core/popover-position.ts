// 週浮窗的定位算式。浮窗掛在 document body 上、用 position: fixed 畫，所以這裡
// 的座標一律是視窗座標（viewport coordinates）。

export interface PopoverRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface PopoverSize {
	width: number;
	height: number;
}

export interface PopoverViewport {
	width: number;
	height: number;
}

export interface PopoverPlacementInput {
	// 被點到的格子（或整條虛線換算出來那一週的格子）。
	anchor: PopoverRect;
	size: PopoverSize;
	// 儀表板分頁的內容範圍：水平方向優先待在這裡面，才不會蓋到右邊的筆記。
	pane: PopoverRect;
	viewport: PopoverViewport;
}

export interface PopoverPlacement {
	left: number;
	top: number;
}

// 浮窗與格子之間的距離，以及浮窗與邊界之間至少要留的空白。
export const POPOVER_GAP = 6;
export const POPOVER_MARGIN = 4;

function clamp(value: number, min: number, max: number): number {
	// max 可能比 min 小（空間根本不夠），這時以 min 為準，寧可往右溢出也不要負座標。
	return Math.max(min, Math.min(value, max));
}

export function placePopover(input: PopoverPlacementInput): PopoverPlacement {
	const { anchor, size, pane, viewport } = input;

	// 儀表板範圍先跟視窗交集：分頁被捲出視窗的部分不能拿來放浮窗。
	const paneLeft = Math.max(0, Math.min(pane.left, viewport.width));
	const paneRight = Math.max(paneLeft, Math.min(pane.right, viewport.width));
	// 範圍不夠寬就退回整個視窗，寧可蓋到旁邊的筆記，也不要把浮窗壓扁或切掉。
	const fitsInPane = paneRight - paneLeft >= size.width + POPOVER_MARGIN * 2;
	const boundLeft = fitsInPane ? paneLeft : 0;
	const boundRight = fitsInPane ? paneRight : viewport.width;

	let left = anchor.left;
	// 往右會越界就改成靠齊格子右緣、往左展開。
	if (left + size.width > boundRight - POPOVER_MARGIN) left = anchor.right - size.width;
	left = clamp(left, boundLeft + POPOVER_MARGIN, boundRight - POPOVER_MARGIN - size.width);

	let top = anchor.bottom + POPOVER_GAP;
	if (top + size.height > viewport.height - POPOVER_MARGIN) {
		top = Math.max(POPOVER_MARGIN, anchor.top - POPOVER_GAP - size.height);
	}

	return { left, top };
}
