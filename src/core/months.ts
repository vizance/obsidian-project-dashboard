import { monthViewCells, type CellKind } from './cells';
import type { ProjectRecord } from './scan';
import { taskLinesForWeek, unscheduledTasks } from './task-lines';
import {
	isoWeekLabelOfDate,
	isoWeekOfDate,
	mondayOfWeek,
	monthOfWeekStart,
	weekInfoFor,
	weekRangeShort,
	type WeekInfo,
	type WeekRules,
} from './weeks';

// month 是 1–12。WeekInfo.month 是 0–11，因為年視圖的表頭直接拿它當月份名稱的索引；
// 月視圖的標題和規格表格（`2026-10`、`2026 年 10 月`）用 1–12，所以兩邊各自保留
// 自己的慣例，只在這個檔案裡換算。
export interface MonthRef {
	year: number;
	month: number;
}

const WEEK_LABEL_RE = /^(\d{4})-W(\d{2})$/;

// 週一規則：一週屬於它星期一落在的那個月，只有 W01 永遠算它那個 ISO 年的一月。
// 月份一律交給 weeks.ts 的 monthOfWeekStart，W01 例外因此只有一處實作。
// 年份也要跟著例外走：W01 的星期一可能落在前一年的 12 月（2026-W01 起於
// 2025-12-29），既然算成一月，年份就取標籤上的 ISO 年而不是星期一的日曆年。
export function monthOfWeek(weekLabel: string): MonthRef {
	const m = WEEK_LABEL_RE.exec(weekLabel);
	if (!m) throw new Error(`invalid week label: ${weekLabel}`);
	const week = Number(m[2]);
	const monday = new Date(`${mondayOfWeek(weekLabel)}T00:00:00Z`);
	return {
		year: week === 1 ? Number(m[1]) : monday.getUTCFullYear(),
		month: monthOfWeekStart(week, monday) + 1,
	};
}

export function weeksOfMonth(year: number, month: number): WeekInfo[] {
	const first = new Date(Date.UTC(year, month - 1, 1));
	// 該月第一個星期一：ISO 星期（1 = 一 … 7 = 日）距離下一個星期一的天數。
	const firstMonday = new Date(first);
	firstMonday.setUTCDate(1 + ((8 - (first.getUTCDay() || 7)) % 7));

	// 候選從第一個星期一的前一週掃到後面五週：W01 的星期一可能落在前一個月
	// （2026 年 1 月的 W01 起於 2025-12-29），而 12 月最後一個星期一可能已經
	// 屬於下一年的 W01。多掃的候選會被 monthOfWeek 的比對濾掉。
	const cursor = new Date(firstMonday);
	cursor.setUTCDate(cursor.getUTCDate() - 7);

	const labels: string[] = [];
	for (let i = 0; i < 7; i++) {
		const label = isoWeekLabelOfDate(cursor);
		const ref = monthOfWeek(label);
		if (ref.year === year && ref.month === month) labels.push(label);
		cursor.setUTCDate(cursor.getUTCDate() + 7);
	}

	// 一個月的週全屬於同一個月，所以只有第一欄是月份與季的起點，和 buildWeeks 一致。
	return labels.map((label, i) => weekInfoFor(label, month - 1, i === 0, i === 0));
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
	const total = ref.year * 12 + (ref.month - 1) + delta;
	return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// 某日期所屬的月份，也就是「它所在那一週」屬於哪個月。這裡用 ISO 週（一到日），
// 不套用週六規則：它決定的是月視圖顯示哪個月，不是任務排在哪一週。
export function monthOfDate(date: string): MonthRef {
	const label = isoWeekOfDate(date);
	if (!label) throw new Error(`invalid ISO date: ${date}`);
	return monthOfWeek(label);
}

// `2026 年 10 月（W41–W44）`。週數不補零，和年視圖的週表頭一致。
export function monthTitle(year: number, month: number, weeks: WeekInfo[]): string {
	const first = weeks[0];
	const last = weeks[weeks.length - 1];
	const range = first && last ? `（W${first.week}–W${last.week}）` : '';
	return `${year} 年 ${month} 月${range}`;
}

export type MonthCellLineState = 'done' | 'overdue' | 'open';

export interface MonthCellLine {
	// 筆記裡的行號，與 TaskLine.line 相同，重繪後還能對回同一行。
	line: number;
	text: string;
	state: MonthCellLineState;
}

// 「完成」直接用 TaskLine.done：勾了 [x]，或行上有 `✅ <日期>` 完成標記。沒有核取
// 方塊的日期行因此一律算沒完成，和規格的 `會議紀錄 📅 …` 那一列相同。
// 「逾期」是沒完成、而且這一格的週比今天那一週早。今天那一週用 ISO 週（一到日），
// 與年視圖標示的今天欄相同，不跟著週六規則跑；任務落在哪一週才用週六規則，
// 也就是 taskLinesForWeek 本身。
export function monthCellLines(
	project: ProjectRecord,
	weekLabel: string,
	settings: WeekRules,
	today: string,
): MonthCellLine[] {
	const todayWeek = isoWeekOfDate(today);
	const overdue = todayWeek !== null && mondayOfWeek(weekLabel) < mondayOfWeek(todayWeek);
	return taskLinesForWeek(project.task_lines, weekLabel, settings).map((l) => ({
		line: l.line,
		text: l.text,
		state: l.done ? 'done' : overdue ? 'overdue' : 'open',
	}));
}

// `blank` 的格子打不開浮窗，所以也不列任務文字（例如任務的日期早於專案開始日）。
// 月視圖每一格都走這個函式，那條規則才只有一處。
export function monthCellTaskLines(
	project: ProjectRecord,
	weekLabel: string,
	kind: CellKind,
	settings: WeekRules,
	today: string,
): MonthCellLine[] {
	if (kind === 'blank') return [];
	return monthCellLines(project, weekLabel, settings, today);
}

// 「還沒排」欄只顯示數量：任務本身在點開的還沒排浮窗裡列出來，所以格子的提示
// 是一句固定的說明，不再把任務抄一遍。
export function unscheduledSummary(project: ProjectRecord): { count: number } {
	return { count: unscheduledTasks(project.task_lines).length };
}

export interface UnscheduledWeekOption {
	label: string;
	// 不補零的週數（`41`），按鈕上寫成 `W41`，和年視圖的週表頭一致。
	week: number;
	range: string;
	enabled: boolean;
}

// 還沒排浮窗的週按鈕：顯示中那個月的每一週一個。能不能按跟那一格能不能打開週浮窗
// 同一條規則 — 格子不是 `blank` 就能按，所以兩邊都問 monthViewCells，不另訂「在不在
// 專案期間」的算法。
export function unscheduledWeekOptions(
	project: ProjectRecord,
	weeks: WeekInfo[],
	settings: WeekRules,
): UnscheduledWeekOption[] {
	const cells = monthViewCells(project, weeks, settings);
	return weeks.map((w, i) => ({
		label: w.label,
		week: w.week,
		range: weekRangeShort(w.label),
		enabled: cells[i]!.kind !== 'blank',
	}));
}
