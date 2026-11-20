import type { ProjectRecord } from './scan';
import { scheduleDateForWeek, taskLinesForWeek, type ScheduleRules, type TaskLine } from './task-lines';
import { addDaysISO, isoWeekOfDate, mondayOfWeek, weekOfTaskDate, type WeekRules } from './weeks';

export interface PhoneProjectLines {
	project: ProjectRecord;
	lines: TaskLine[];
}

export interface PhoneWeek {
	week: string;
	groups: PhoneProjectLines[];
}

export function phoneWeekLabels(today: string): string[] {
	const current = isoWeekOfDate(today);
	if (!current) return [];
	const monday = mondayOfWeek(current);
	return [0, 7, 14, 21].map((days) => isoWeekOfDate(addDaysISO(monday, days))!);
}

export function phoneWeekGroups(projects: ProjectRecord[], weekLabels: string[], rules: WeekRules): PhoneWeek[] {
	return weekLabels.map((week) => ({
		week,
		groups: projects.flatMap((project) => {
			const lines = taskLinesForWeek(project.task_lines, week, rules);
			return lines.length ? [{ project, lines }] : [];
		}),
	}));
}

export function overdueLines(projects: ProjectRecord[], rules: WeekRules, today: string): PhoneProjectLines[] {
	const current = isoWeekOfDate(today);
	if (!current) return [];
	const monday = mondayOfWeek(current);
	return projects.flatMap((project) => {
		const lines = project.task_lines.filter((line) => {
			if (!line.checkbox || line.done || line.due === null) return false;
			const mapped = weekOfTaskDate(line.due, rules);
			return mapped !== null && mondayOfWeek(mapped.label) < monday;
		}).sort((a, b) => a.due!.localeCompare(b.due!) || a.line - b.line);
		return lines.length ? [{ project, lines }] : [];
	});
}

export function scheduleToThisWeekDays(line: TaskLine, rules: ScheduleRules, today: string): number {
	const current = isoWeekOfDate(today);
	if (!current || line.due === null) return 0;
	const scheduled = scheduleDateForWeek(current, rules);
	return (Date.parse(`${scheduled}T00:00:00Z`) - Date.parse(`${line.due}T00:00:00Z`)) / 86400000;
}
