import { quarterOf, type WeekInfo } from './weeks';

export type YearColumn =
	| { kind: 'weeks'; start: number; end: number }
	| { kind: 'fold'; quarter: number };

export function quarterOfWeek(week: WeekInfo): number {
	return quarterOf(week.month);
}

export function defaultFoldedQuarters(weeks: WeekInfo[], todayIdx: number): number[] {
	const todayWeek = weeks[todayIdx];
	if (!todayWeek) return [];
	return Array.from({ length: quarterOfWeek(todayWeek) - 1 }, (_, index) => index + 1);
}

export function yearColumns(weeks: WeekInfo[], folded: ReadonlySet<number>): YearColumn[] {
	const columns: YearColumn[] = [];
	for (const [index, week] of weeks.entries()) {
		const quarter = quarterOfWeek(week);
		const last = columns[columns.length - 1];
		if (folded.has(quarter)) {
			if (last?.kind !== 'fold' || last.quarter !== quarter) columns.push({ kind: 'fold', quarter });
		} else if (last?.kind === 'weeks') {
			last.end = index + 1;
		} else {
			columns.push({ kind: 'weeks', start: index, end: index + 1 });
		}
	}
	return columns;
}

export function centeredScrollLeft(input: {
	scrollLeft: number;
	columnLeft: number;
	columnRight: number;
	areaLeft: number;
	areaRight: number;
	maxScrollLeft: number;
}): number {
	const centered = input.scrollLeft + (input.columnLeft + input.columnRight) / 2 - (input.areaLeft + input.areaRight) / 2;
	return Math.round(Math.max(0, Math.min(input.maxScrollLeft, centered)));
}

export function columnFullyVisible(
	column: { left: number; right: number },
	area: { left: number; right: number },
): boolean {
	return column.left >= area.left - 1 && column.right <= area.right + 1;
}
