import { EXCLUDED_PROJECTS, KEYWORD_RULES, MANUAL_OVERRIDES, PROJECT_FOLDER } from './core/config';
import type { ClassificationRule, DashboardSettings } from './core/settings';

// TEMPORARY until task 2.2 wires the stored settings into the plugin.
//
// src/core already takes the settings as a parameter, but the plugin still gets
// them from the build-time rules in src/core/config.ts. Building the object here
// — in one place, with the same order classify() used before (manual fragments
// first, then keyword rules) and the date rules that were hard-coded (Friday,
// Saturday counts as next week) — keeps the running plugin behaving exactly as
// it did. Task 2.2 replaces every use of this with the plugin data store.
const legacyRules: ClassificationRule[] = [
	...Object.entries(MANUAL_OVERRIDES).map(([text, category]) => ({ text, category })),
	...KEYWORD_RULES.map(([text, category]) => ({ text, category })),
];

export const TEMPORARY_SETTINGS: DashboardSettings = {
	projectFolder: PROJECT_FOLDER,
	classificationRules: legacyRules,
	excludedProjects: [...EXCLUDED_PROJECTS],
	scheduleWeekday: 5,
	saturdayCountsAsNextWeek: true,
};
