// Template for your own classification rules.
//
// Copy this file to `personal-rules.local.ts` and edit the values below to
// match your vault. `personal-rules.local.ts` is git-ignored, so your real
// project folder, keywords, and overrides never leave your machine.
//
// If `personal-rules.local.ts` is missing, `scripts/ensure-local-rules.mjs`
// copies this file there automatically before install/build/test/lint/deploy.

export const PROJECT_FOLDER = 'Projects';

export const KEYWORD_RULES: Array<[string, string]> = [
	['企業內訓', 'corporate'],
	['內訓', 'corporate'],

	['線上課程', 'online_course'],
	['課程', 'online_course'],

	['出版', 'publishing'],

	['教練', 'coaching'],
	['諮詢', 'coaching'],

	['業配', 'sponsorship'],
	['合作', 'sponsorship'],

	['生活', 'life'],
];

// A full project name can be force-classified regardless of keyword rules.
export const MANUAL_OVERRIDES: Record<string, string> = {
	'特別接案專案': 'coaching',
};

// A full project name (or fragment) listed here is skipped entirely, e.g. a
// personal test note kept in the project folder.
export const EXCLUDED_PROJECTS: string[] = ['內部測試用專案'];
