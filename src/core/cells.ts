import type { ProjectRecord } from './scan';
import {
	isoWeekLabelOfDate,
	mondayOfWeek,
	weekOfTaskDate,
	type WeekInfo,
	type WeekRules,
} from './weeks';

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

// 任務是否顯示只由它對應的週決定；預計日期只影響樣式，不能把任務藏起來。
export function weekCellKind(project: ProjectRecord, week: WeekInfo): CellKind {
	if (!project.start || !project.end) return 'blank';
	const closed = project.status === 'done' || project.status === 'cancelled';
	const end = parseDate(project.end);
	if (project.occupied_weeks.includes(week.label)) {
		if (closed) return 'solid';
		if (week.start >= end) return 'overflow';
		return project.settled_weeks.includes(week.label) ? 'settled' : 'solid';
	}
	const inRange = week.start < end && week.end > parseDate(project.start);
	return inRange && !closed ? 'dashed' : 'blank';
}

export function perWeekCells(project: ProjectRecord, weeks: WeekInfo[], rules: WeekRules): Cell[] {
	const isClosed = project.status === 'done' || project.status === 'cancelled';
	const datesByWeek = new Map<string, TaskOccurrence[]>();
	for (const t of project.tasks) {
		const wl = weekOfTaskDate(t.date, rules);
		if (!wl) continue;
		const arr = datesByWeek.get(wl.label) ?? [];
		arr.push({ date: t.date, bumped: wl.isBumpedSat, kind: t.kind, text: t.text });
		datesByWeek.set(wl.label, arr);
	}

	const cells = weeks.map((w): Cell => {
		const kind = weekCellKind(project, w);
		if (kind === 'blank') return blankCell(isClosed);
		return {
			kind,
			spanWeeks: 1,
			tooltip: kind === 'dashed'
				? `${project.name}\n本週無排定任務`
				: buildWeekTooltip(project.name, project.end, w.label, datesByWeek.get(w.label) ?? [], kind === 'overflow'),
			closed: isClosed,
		};
	});

	// 只合併顯示中的期間，避免為了裁切色條而列舉專案跨越的所有週。
	if (project.task_dates.length === 0 && project.occupied_weeks.length === 0 && !isClosed) {
		const first = cells.findIndex((cell) => cell.kind === 'dashed');
		if (first !== -1) {
			const spanWeeks = cells.filter((cell) => cell.kind === 'dashed').length;
			cells[first] = {
				kind: 'span-dashed', spanWeeks, closed: isClosed,
				tooltip: `${project.name}\n虛線 ${project.start} ~ ${project.end}（未排定任務）`,
			};
			for (let i = first + 1; i < first + spanWeeks; i++) cells[i] = blankCell(isClosed);
		}
	}
	return cells;
}

// 年視圖畫成一條 span-dashed 的那一段，月視圖要每週一格，所以把它攤成一個個 dashed
// （原本被 span 蓋住的格子是 blank，一併換掉）。回傳的每一格都 spanWeeks === 1。
function expandSpanDashed(cells: Cell[]): Cell[] {
	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i]!;
		if (cell.kind !== 'span-dashed') continue;
		const last = Math.min(cells.length - 1, i + cell.spanWeeks - 1);
		for (let j = i; j <= last; j++) {
			cells[j] = { kind: 'dashed', spanWeeks: 1, tooltip: cell.tooltip, closed: cell.closed };
		}
		i = last;
	}
	return cells;
}

// 月視圖沿用相同的逐週判斷，只將未排任務的整條虛線攤成每週一格。
export function monthViewCells(project: ProjectRecord, weeks: WeekInfo[], rules: WeekRules): Cell[] {
	return expandSpanDashed(perWeekCells(project, weeks, rules));
}

export function yearViewCells(
	project: ProjectRecord,
	weeks: WeekInfo[],
	rules: WeekRules,
	mode: 'per-week' | 'timeline',
): Cell[] {
	return mode === 'timeline' ? timelineCells(project, weeks) : perWeekCells(project, weeks, rules);
}

export function timelineCells(project: ProjectRecord, weeks: WeekInfo[]): Cell[] {
	const isClosed = project.status === 'done' || project.status === 'cancelled';
	const cells = weeks.map(() => blankCell(isClosed));
	if (!project.start || !project.end) return cells;

	let left = parseDate(mondayOfWeek(isoWeekLabelOfDate(parseDate(project.start))));
	let right = parseDate(mondayOfWeek(isoWeekLabelOfDate(parseDate(project.end))));
	for (const label of project.occupied_weeks) {
		const monday = parseDate(mondayOfWeek(label));
		if (monday < left) left = monday;
		if (monday > right) right = monday;
	}
	const startIdx = weeks.findIndex((w) => w.end > left && w.start <= right);
	if (startIdx === -1) return cells;
	let rightIdx = startIdx;
	for (let i = startIdx + 1; i < weeks.length; i++) {
		if (weeks[i]!.start <= right) rightIdx = i;
	}
	const rightEndLabel = project.overflow_end && project.overflow_end > project.end ? project.overflow_end : project.end;
	cells[startIdx] = {
		kind: 'span-solid',
		spanWeeks: rightIdx - startIdx + 1,
		tooltip: `${project.name}\n${project.start} ~ ${rightEndLabel}`,
		closed: isClosed,
	};
	return cells;
}

// 整條虛線（span-dashed）只畫在起始格裡、用寬度蓋過後面的格子，所以點擊時要自己
// 換算是第幾週：點擊位置到左緣的距離 ÷ 每週寬度，夾在 0 與 weeks - 1 之間。
export function spanWeekOffset(offset: number, width: number, weeks: number): number {
	if (weeks <= 1 || width <= 0) return 0;
	const weekWidth = width / weeks;
	const index = Math.floor(offset / weekWidth);
	return Math.max(0, Math.min(weeks - 1, index));
}

export function visibleProjects(projects: ProjectRecord[], showClosed: boolean, showPaused = false): ProjectRecord[] {
	return projects.filter((p) => {
		const isClosed = p.status === 'done' || p.status === 'cancelled';
		if (!showClosed && isClosed) return false;
		if (!showPaused && p.status === 'pending') return false;
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
