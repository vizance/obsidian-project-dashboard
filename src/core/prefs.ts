const DEFAULT_CATEGORY_ORDER = ['corporate', 'online_course', 'coaching', 'publishing', 'sponsorship', 'life', 'other'];

const PROJ_COL_MIN = 120;
const PROJ_COL_MAX = 600;
const PROJ_COL_DEFAULT = 280;

export function parseViewMode(raw: string | null): 'per-week' | 'timeline' {
	return raw === 'timeline' || raw === 'per-week' ? raw : 'per-week';
}

export function parseCategoryOrder(raw: string | null, categoryKeys: string[]): string[] {
	let stored: string[] | null = null;
	try {
		if (raw !== null) {
			const parsed: unknown = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.every((k) => typeof k === 'string')) {
				stored = parsed;
			}
		}
	} catch {
		stored = null;
	}
	const base = stored && stored.length ? stored : DEFAULT_CATEGORY_ORDER;
	const filtered = base.filter((k) => categoryKeys.includes(k));
	const missing = categoryKeys.filter((k) => !filtered.includes(k));
	return [...filtered, ...missing];
}

export function parsePinnedCategory(raw: string | null, categoryKeys: string[]): string | null {
	try {
		if (raw === null) return null;
		const parsed: unknown = JSON.parse(raw);
		if (parsed === null) return null;
		if (typeof parsed !== 'string') return null;
		if (!categoryKeys.includes(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clampProjColWidth(n: number): number {
	return Math.max(PROJ_COL_MIN, Math.min(PROJ_COL_MAX, n));
}

export function parseProjColWidth(raw: string | null): number {
	if (raw === null) return PROJ_COL_DEFAULT;
	const n = parseInt(raw, 10);
	if (Number.isNaN(n)) return PROJ_COL_DEFAULT;
	return clampProjColWidth(n);
}

export function resolveInitialHelpPanel(
	firstSeenRaw: string | null,
	openRaw: string | null,
): { visible: boolean; markFirstSeen: boolean } {
	if (firstSeenRaw === null) {
		return { visible: true, markFirstSeen: true };
	}
	return { visible: openRaw === 'true', markFirstSeen: false };
}

export function applyCategoryOverride(
	overrides: Record<string, string>,
	project: string,
	category: string | null,
	categoryKeys: string[],
): { ok: boolean; overrides: Record<string, string> } {
	if (category === null || category === '') {
		const next = { ...overrides };
		delete next[project];
		return { ok: true, overrides: next };
	}
	if (!categoryKeys.includes(category)) {
		return { ok: false, overrides };
	}
	return { ok: true, overrides: { ...overrides, [project]: category } };
}
