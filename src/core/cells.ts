import type { ProjectRecord } from './scan';
import { weekOfTaskDate, type WeekInfo, type WeekRules } from './weeks';

export type CellKind = 'solid' | 'settled' | 'overflow' | 'dashed' | 'span-dashed' | 'span-solid' | 'blank';

export interface Cell {
	kind: CellKind;
	spanWeeks: number;
	tooltip: string;
	closed: boolean;
}

function parseDate(s: string): Date {
	return new Date(`${s}T00:00:00Z`);
}

interface TaskOccurrence {
	date: string;
	bumped: boolean;
	kind: 'done' | 'planned';
	text: string;
}

function buildWeekTooltip(
	name: string,
	end: string | null,
	weekLabel: string,
	entries: TaskOccurrence[],
	isOverflow = false,
): string {
	const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date));
	const lines = sorted.map((x) => {
		const mark = x.kind === 'done' ? '✓' : '·';
		const status = x.kind === 'done' ? '已完成' : '預計';
		const sat = x.bumped ? ' (Sat → 本週)' : '';
		const label = x.text ? x.text : '(無描述)';
		return `${mark} ${label}（${x.date} ${status}${sat}）`;
	});
	const header = isOverflow
		? `${name}\n⚠ overflow ${weekLabel}（已超出預計結束日期 ${end}）`
		: `${name}\n${weekLabel}`;
	return header + (lines.length ? `\n${lines.join('\n')}` : '');
}

function blankCell(closed: boolean): Cell {
	return { kind: 'blank', spanWeeks: 1, tooltip: '', closed };
}

export function perWeekCells(project: ProjectRecord, weeks: WeekInfo[], rules: WeekRules): Cell[] {
	const isClosed = project.status === 'done' || project.status === 'cancelled';

	if (!project.start || !project.end) {
		return weeks.map(() => blankCell(isClosed));
	}

	const start = parseDate(project.start);
	const end = parseDate(project.end);
	const overflowEnd = project.overflow_end ? parseDate(project.overflow_end) : null;

	const startIdx = weeks.findIndex((w) => end >= w.start && start < w.end);
	let endIdx = -1;
	for (let i = weeks.length - 1; i >= 0; i--) {
		if (weeks[i]!.start < end) {
			endIdx = i;
			break;
		}
	}

	let overflowEndIdx = -1;
	if (overflowEnd && endIdx !== -1) {
		for (let j = weeks.length - 1; j >= 0; j--) {
			if (weeks[j]!.start < overflowEnd) {
				overflowEndIdx = j;
				break;
			}
		}
		if (overflowEndIdx <= endIdx) overflowEndIdx = -1;
	}

	const hasTaskDates = project.task_dates.length > 0;
	const occupiedSet = new Set(project.occupied_weeks);
	const settledSet = new Set(project.settled_weeks);
	const datesByWeek = new Map<string, TaskOccurrence[]>();
	for (const t of project.tasks) {
		const wl = weekOfTaskDate(t.date, rules);
		if (!wl) continue;
		const arr = datesByWeek.get(wl.label) ?? [];
		arr.push({ date: t.date, bumped: wl.isBumpedSat, kind: t.kind, text: t.text });
		datesByWeek.set(wl.label, arr);
	}

	const useFallbackDashed = !hasTaskDates && !isClosed && startIdx !== -1;

	return weeks.map((w, i) => {
		if (useFallbackDashed) {
			if (i === startIdx) {
				return {
					kind: 'span-dashed',
					spanWeeks: endIdx - startIdx + 1,
					tooltip: `${project.name}\n虛線 ${project.start} ~ ${project.end}（未排定任務）`,
					closed: isClosed,
				};
			}
			return blankCell(isClosed);
		}

		const inRange = startIdx !== -1 && i >= startIdx && i <= endIdx;
		const inOverflow = overflowEndIdx !== -1 && i > endIdx && i <= overflowEndIdx;
		const isOccupied = occupiedSet.has(w.label);

		if (isOccupied && inRange) {
			const settled = !isClosed && settledSet.has(w.label);
			return {
				kind: settled ? 'settled' : 'solid',
				spanWeeks: 1,
				tooltip: buildWeekTooltip(project.name, project.end, w.label, datesByWeek.get(w.label) ?? []),
				closed: isClosed,
			};
		}
		if (isOccupied && inOverflow) {
			return {
				kind: 'overflow',
				spanWeeks: 1,
				tooltip: buildWeekTooltip(project.name, project.end, w.label, datesByWeek.get(w.label) ?? [], true),
				closed: isClosed,
			};
		}
		if (!isOccupied && inRange && !isClosed) {
			return {
				kind: 'dashed',
				spanWeeks: 1,
				tooltip: `${project.name}\n本週無排定任務`,
				closed: isClosed,
			};
		}
		return blankCell(isClosed);
	});
}

export function timelineCells(project: ProjectRecord, weeks: WeekInfo[]): Cell[] {
	const isClosed = project.status === 'done' || project.status === 'cancelled';

	if (!project.start || !project.end) {
		return weeks.map(() => blankCell(isClosed));
	}

	const start = parseDate(project.start);
	const end = parseDate(project.end);
	const rightEndDate = project.overflow_end && project.overflow_end > project.end ? parseDate(project.overflow_end) : end;
	const rightEndLabel = project.overflow_end && project.overflow_end > project.end ? project.overflow_end : project.end;

	const startIdx = weeks.findIndex((w) => end >= w.start && start < w.end);
	let rightIdx = -1;
	for (let i = weeks.length - 1; i >= 0; i--) {
		if (weeks[i]!.start < rightEndDate) {
			rightIdx = i;
			break;
		}
	}

	return weeks.map((_w, i) => {
		if (i === startIdx && startIdx !== -1 && rightIdx >= startIdx) {
			return {
				kind: 'span-solid',
				spanWeeks: rightIdx - startIdx + 1,
				tooltip: `${project.name}\n${project.start} ~ ${rightEndLabel}`,
				closed: isClosed,
			};
		}
		return blankCell(isClosed);
	});
}

// 整條虛線（span-dashed）只畫在起始格裡、用寬度蓋過後面的格子，所以點擊時要自己
// 換算是第幾週：點擊位置到左緣的距離 ÷ 每週寬度，夾在 0 與 weeks - 1 之間。
export function spanWeekOffset(offset: number, width: number, weeks: number): number {
	if (weeks <= 1 || width <= 0) return 0;
	const weekWidth = width / weeks;
	const index = Math.floor(offset / weekWidth);
	return Math.max(0, Math.min(weeks - 1, index));
}

export function visibleProjects(projects: ProjectRecord[], showClosed: boolean): ProjectRecord[] {
	return projects.filter((p) => {
		const isClosed = p.status === 'done' || p.status === 'cancelled';
		if (!showClosed && isClosed) return false;
		if (!p.start || !p.end) return false;
		return true;
	});
}

export function sortProjects(
	projects: ProjectRecord[],
	categoryOrder: string[],
	pinned: string | null,
): ProjectRecord[] {
	return [...projects].sort((a, b) => {
		if (pinned) {
			const aPin = a.category === pinned ? 0 : 1;
			const bPin = b.category === pinned ? 0 : 1;
			if (aPin !== bPin) return aPin - bPin;
		}
		const aIdx = categoryOrder.indexOf(a.category);
		const bIdx = categoryOrder.indexOf(b.category);
		if (aIdx !== bIdx) return aIdx - bIdx;
		return a.start! < b.start! ? -1 : a.start! > b.start! ? 1 : 0;
	});
}
