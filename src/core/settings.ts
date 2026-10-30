import { CATEGORY_KEYS } from './config';

// 一條分類規則：專案名稱包含 `text` 就歸到 `category`。
export interface ClassificationRule {
	text: string;
	category: string;
}

export interface DashboardSettings {
	projectFolder: string;
	classificationRules: ClassificationRule[];
	excludedProjects: string[];
	// 1（星期一）到 7（星期日）的整數。
	scheduleWeekday: number;
	saturdayCountsAsNextWeek: boolean;
}

export interface PluginData {
	categoryOverrides: Record<string, string>;
	settings: DashboardSettings;
}

export const DEFAULT_PROJECT_FOLDER = 'Projects';
export const DEFAULT_SCHEDULE_WEEKDAY = 5;

// 十條預設分類規則，順序就是比對順序：較長的詞排在包含它的短詞之前，
// 「企業內訓」才不會先被「內訓」吃掉（兩者同分類，但順序規則要看得出來）。
export const DEFAULT_CLASSIFICATION_RULES: readonly ClassificationRule[] = [
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

// 工廠函式而不是常數：每次都給一份新的陣列與新的規則物件，呼叫端改到回傳值時
// 不會連預設值一起改掉（Object.assign 共用參照的問題）。
export function defaultSettings(): DashboardSettings {
	return {
		projectFolder: DEFAULT_PROJECT_FOLDER,
		classificationRules: DEFAULT_CLASSIFICATION_RULES.map((r) => ({ ...r })),
		excludedProjects: [],
		scheduleWeekday: DEFAULT_SCHEDULE_WEEKDAY,
		saturdayCountsAsNextWeek: false,
	};
}

function normalizeProjectFolder(raw: unknown): string {
	if (typeof raw !== 'string') return DEFAULT_PROJECT_FOLDER;
	// 前後的 `/` 去掉：使用者從 Obsidian 複製路徑時常會帶著，而 vault 的
	// getAbstractFileByPath 只認不帶斜線的寫法。
	const folder = raw.trim().replace(/^\/+/, '').replace(/\/+$/, '').trim();
	return folder === '' ? DEFAULT_PROJECT_FOLDER : folder;
}

function normalizeClassificationRules(raw: unknown): ClassificationRule[] {
	if (!Array.isArray(raw)) return DEFAULT_CLASSIFICATION_RULES.map((r) => ({ ...r }));
	const rules: ClassificationRule[] = [];
	for (const entry of raw) {
		if (typeof entry !== 'object' || entry === null) continue;
		const { text, category } = entry as { text?: unknown; category?: unknown };
		if (typeof text !== 'string') continue;
		if (typeof category !== 'string' || !CATEGORY_KEYS.includes(category)) continue;
		// 文字空白的規則照樣留著：剛按「新增分類規則」還沒打字的那一列，存檔後
		// 不能消失，否則設定頁的列與存起來的清單會對不上。分類時再跳過它。
		rules.push({ text: text.trim(), category });
	}
	return rules;
}

function normalizeExcludedProjects(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const result: string[] = [];
	for (const entry of raw) {
		if (typeof entry !== 'string') continue;
		const trimmed = entry.trim();
		// 空白的一行會讓每個專案都「包含」它而整個儀表板清空，所以丟掉。
		if (trimmed !== '') result.push(trimmed);
	}
	return result;
}

function normalizeScheduleWeekday(raw: unknown): number {
	if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 7) return DEFAULT_SCHEDULE_WEEKDAY;
	return raw;
}

// 每個欄位各自檢查：一個欄位壞掉只換成該欄位的預設值，其他設定照舊。
export function normalizeSettings(raw: unknown): DashboardSettings {
	const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	return {
		projectFolder: normalizeProjectFolder(source.projectFolder),
		classificationRules: normalizeClassificationRules(source.classificationRules),
		excludedProjects: normalizeExcludedProjects(source.excludedProjects),
		scheduleWeekday: normalizeScheduleWeekday(source.scheduleWeekday),
		saturdayCountsAsNextWeek: typeof source.saturdayCountsAsNextWeek === 'boolean'
			? source.saturdayCountsAsNextWeek
			: false,
	};
}

function isPlainStringRecord(value: unknown): value is Record<string, string> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	return Object.values(value).every((v) => typeof v === 'string');
}

export function normalizePluginData(raw: unknown): PluginData {
	const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	const overrides = source.categoryOverrides;
	return {
		// 不是「每個值都是字串的物件」就整份丟掉；分類鍵不存在的項目由 classify 忽略。
		categoryOverrides: isPlainStringRecord(overrides) ? { ...overrides } : {},
		settings: normalizeSettings(source.settings),
	};
}
