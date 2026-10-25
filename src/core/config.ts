export interface CategoryDef {
	label: string;
	color: string;
}

export const CATEGORIES: Record<string, CategoryDef> = {
	corporate: { label: '企業內訓', color: '#3B82F6' },
	online_course: { label: '線上課程 / Cohort', color: '#F97316' },
	coaching: { label: '1-on-1 教練', color: '#A855F7' },
	publishing: { label: '出版', color: '#10B981' },
	sponsorship: { label: '業配 / 合作', color: '#CA8A04' },
	life: { label: '生活', color: '#EC4899' },
	other: { label: '其他', color: '#6B7280' },
};

export const CATEGORY_KEYS: string[] = Object.keys(CATEGORIES);

export { PROJECT_FOLDER, KEYWORD_RULES, MANUAL_OVERRIDES, EXCLUDED_PROJECTS } from './personal-rules.local';
