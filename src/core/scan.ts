import { CATEGORIES, CATEGORY_KEYS, EXCLUDED_PROJECTS, KEYWORD_RULES, MANUAL_OVERRIDES } from './config';
import { cleanTaskText, parseTaskLines, type TaskLine } from './task-lines';

export type ProjectStatus = 'pending' | 'active' | 'done' | 'cancelled';

export interface TaskEntry {
	date: string;
	kind: 'done' | 'planned';
	text: string;
	done: boolean;
}

export interface ProjectRecord {
	name: string;
	category: string;
	color: string;
	status: ProjectStatus;
	start: string | null;
	end: string | null;
	promised_end: string | null;
	overflow_end: string | null;
	task_dates: string[];
	tasks: TaskEntry[];
	occupied_weeks: string[];
	settled_weeks: string[];
	warnings: string[];
	path: string;
	task_lines: TaskLine[];
}

export interface ScanInput {
	filename: string;
	text: string;
	path: string;
}

export interface ScanContext {
	overrides: Record<string, string>;
	today: string;
}

const STATUS_EMOJI: Array<[string, ProjectStatus]> = [
	['⏳', 'pending'],
	['🚧', 'active'],
	['✅', 'done'],
	['❌', 'cancelled'],
];

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
// 檔名範圍 e.g. "20260413 ~ 1213" 或 "20260101 ~ 0111"
const RANGE_RE = /(\d{8})\s*~\s*(\d{4,8})/;
// 等同 Python 的 (?<!\d)(\d{8})(?!\d)，不使用 lookbehind：
// (?:^|\D) 消耗前一個字元（若存在且非數字），達到相同的「不在數字串中間」效果。
const SINGLE_DATE_RE = /(?:^|\D)(\d{8})(?!\d)/g;
const SHORT_DATE_RE = /&\s*(\d{4})(?!\d)/g;
// 任務內聯日期：📅 或 ✅ 後接 ISO YYYY-MM-DD
const TASK_DATE_RE = /(?:📅|✅)\s+(\d{4}-\d{2}-\d{2})/g;
// 帶類型的任務標記：📅=預計、✅=已完成
const TASK_MARKER_RE = /(📅|✅)\s+(\d{4}-\d{2}-\d{2})/g;
// 已打勾的 checkbox（任務層級「完成」訊號之一）
const CHECKBOX_DONE_RE = /^[-*+]\s*\[[xX]\]/;
// 完成標記要「✅ 後面接日期」才算；連到已完成筆記的 [[✅ …]] 只是連結，不代表這個任務做完了。
const DONE_MARKER_RE = /✅\s+\d{4}-\d{2}-\d{2}/;

function compareByCodePoint(a: string, b: string): number {
	const ca = Array.from(a);
	const cb = Array.from(b);
	const len = Math.min(ca.length, cb.length);
	for (let i = 0; i < len; i++) {
		const pa = ca[i]!.codePointAt(0)!;
		const pb = cb[i]!.codePointAt(0)!;
		if (pa !== pb) return pa - pb;
	}
	return ca.length - cb.length;
}

export function parseFrontmatter(text: string): Record<string, string> {
	if (!text.startsWith('---')) return {};
	const end = text.indexOf('\n---', 3);
	if (end === -1) return {};
	const block = text.slice(3, end).trim();
	const data: Record<string, string> = {};
	for (const line of block.split(/\r\n|\r|\n/)) {
		if (!line.includes(':')) continue;
		const idx = line.indexOf(':');
		const k = line.slice(0, idx).trim();
		const v = line.slice(idx + 1).trim();
		data[k] = v;
	}
	return data;
}

export function detectStatus(filename: string): ProjectStatus {
	const head = Array.from(filename).slice(0, 3).join('');
	for (const [emoji, status] of STATUS_EMOJI) {
		if (head.includes(emoji)) return status;
	}
	return 'active';
}

export function stripStatus(filename: string): string {
	let name = filename;
	for (const [emoji] of STATUS_EMOJI) {
		name = name.split(emoji).join('');
	}
	name = name.trim();
	if (name.endsWith('.md')) {
		name = name.slice(0, -3);
	}
	return name.trim();
}

export function classify(name: string, overrides?: Record<string, string> | null): string {
	if (overrides) {
		const cat = overrides[name];
		if (cat !== undefined && CATEGORY_KEYS.includes(cat)) return cat;
	}
	for (const [key, cat] of Object.entries(MANUAL_OVERRIDES)) {
		if (name.includes(key)) return cat;
	}
	for (const [keyword, cat] of KEYWORD_RULES) {
		if (name.includes(keyword)) return cat;
	}
	return 'other';
}

export function parseDateStr(s: string | undefined | null): string | null {
	const m = DATE_RE.exec(s ?? '');
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseFilenameDates(name: string): [string | null, string | null] {
	const rangeMatch = RANGE_RE.exec(name);
	if (rangeMatch) {
		const startRaw = rangeMatch[1]!;
		const endRaw = rangeMatch[2]!;
		const start = `${startRaw.slice(0, 4)}-${startRaw.slice(4, 6)}-${startRaw.slice(6, 8)}`;
		let end: string;
		if (endRaw.length === 4) {
			end = `${startRaw.slice(0, 4)}-${endRaw.slice(0, 2)}-${endRaw.slice(2, 4)}`;
		} else {
			end = `${endRaw.slice(0, 4)}-${endRaw.slice(4, 6)}-${endRaw.slice(6, 8)}`;
		}
		return [start, end];
	}

	const dates = Array.from(name.matchAll(SINGLE_DATE_RE), (m) => m[1]!);
	const shortDates = Array.from(name.matchAll(SHORT_DATE_RE), (m) => m[1]!);

	if (dates.length > 0) {
		const first = dates[0]!;
		const start = `${first.slice(0, 4)}-${first.slice(4, 6)}-${first.slice(6, 8)}`;
		const year = first.slice(0, 4);
		const allEnds = [...dates.slice(1), ...shortDates.map((s) => `${year}${s}`)];
		let end: string;
		if (allEnds.length > 0) {
			const last = [...allEnds].sort()[allEnds.length - 1]!;
			end = `${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6, 8)}`;
		} else {
			end = start;
		}
		return [start, end];
	}

	return [null, null];
}

function parseISODate(s: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const da = Number(m[3]);
	const d = new Date(Date.UTC(y, mo - 1, da));
	if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) return null;
	return d;
}

function isoWeekOf(d: Date): { year: number; week: number } {
	const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const dayNum = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - dayNum + 3);
	const firstThursday = date.getTime();
	const yearStart = new Date(firstThursday);
	yearStart.setUTCMonth(0, 1);
	if (yearStart.getUTCDay() !== 4) {
		yearStart.setUTCMonth(0, 1 + ((4 - yearStart.getUTCDay()) + 7) % 7);
	}
	const week = 1 + Math.round((firstThursday - yearStart.getTime()) / (7 * 24 * 3600 * 1000));
	return { year: new Date(firstThursday).getUTCFullYear(), week };
}

export function computeOccupiedWeeks(taskDateStrings: string[]): string[] {
	const labels = new Set<string>();
	for (const s of taskDateStrings) {
		const d = parseISODate(s);
		if (!d) continue;
		// JS getUTCDay(): Sun=0 .. Sat=6; Saturday rolls to the following week.
		const target = d.getUTCDay() === 6 ? new Date(d.getTime() + 2 * 24 * 3600 * 1000) : d;
		const { year, week } = isoWeekOf(target);
		labels.add(`${year}-W${String(week).padStart(2, '0')}`);
	}
	return Array.from(labels).sort();
}

export function parseTaskDates(text: string): string[] {
	return Array.from(text.matchAll(TASK_DATE_RE), (m) => m[1]!);
}

export function parseTasks(text: string): TaskEntry[] {
	const tasks: TaskEntry[] = [];
	for (const line of text.split(/\r\n|\r|\n/)) {
		const markers = Array.from(line.matchAll(TASK_MARKER_RE));
		if (markers.length === 0) continue;
		const desc = cleanTaskText(line);
		const trimmed = line.trim();
		const lineDone = CHECKBOX_DONE_RE.test(trimmed) || DONE_MARKER_RE.test(line);
		for (const m of markers) {
			const emoji = m[1]!;
			const date = m[2]!;
			tasks.push({
				date,
				kind: emoji === '✅' ? 'done' : 'planned',
				text: desc,
				done: lineDone,
			});
		}
	}
	return tasks;
}

export function scanProjectNote(input: ScanInput, ctx: ScanContext): ProjectRecord | null {
	const cleanName = stripStatus(input.filename);
	if (EXCLUDED_PROJECTS.some((skip) => cleanName.includes(skip))) return null;

	const text = input.text;
	const fm = parseFrontmatter(text);

	const status = detectStatus(input.filename);
	const category = classify(cleanName, ctx.overrides);
	const color = CATEGORIES[category]!.color;

	const taskDatesRaw = parseTaskDates(text);
	const taskDates = Array.from(new Set(taskDatesRaw)).sort();
	const tasks = parseTasks(text);
	const promisedEnd = taskDates.length > 0 ? taskDates[taskDates.length - 1]! : null;
	const occupiedWeeks = computeOccupiedWeeks(taskDates);
	const notDoneDates = tasks.filter((t) => !t.done).map((t) => t.date);
	const outstandingWeeks = new Set(computeOccupiedWeeks(notDoneDates));
	const settledWeeks = occupiedWeeks.filter((w) => !outstandingWeeks.has(w));

	let start = parseDateStr(fm['開始日期'] ?? '');
	let end = parseDateStr(fm['預計結束日期'] ?? '') ?? parseDateStr(fm['實際結束日期'] ?? '');

	const warnings: string[] = [];

	if (!start || !end) {
		const [fnStart, fnEnd] = parseFilenameDates(cleanName);
		if (!start && fnStart) {
			start = fnStart;
			warnings.push('起日由檔名推得');
		}
		if (!end && fnEnd) {
			end = fnEnd;
			warnings.push('迄日由檔名推得');
		}
	}

	const defaultEnd = `${ctx.today.slice(0, 4)}-12-31`;
	if (!end && start && start <= defaultEnd) {
		end = defaultEnd;
		warnings.push(`迄日預設為 ${defaultEnd}`);
	}

	if (!start) warnings.push('缺開始日期');
	if (!end) warnings.push('缺預計結束日期');

	let overflowEnd: string | null = null;
	if (
		promisedEnd !== null &&
		end !== null &&
		promisedEnd > end &&
		status !== 'done' &&
		status !== 'cancelled'
	) {
		overflowEnd = promisedEnd;
	}

	return {
		name: cleanName,
		category,
		color,
		status,
		start,
		end,
		promised_end: promisedEnd,
		overflow_end: overflowEnd,
		task_dates: taskDates,
		tasks,
		occupied_weeks: occupiedWeeks,
		settled_weeks: settledWeeks,
		warnings,
		path: input.path,
		task_lines: parseTaskLines(text),
	};
}

export function scanProjectFolder(files: ScanInput[], ctx: ScanContext): ProjectRecord[] {
	const sorted = [...files].sort((a, b) => compareByCodePoint(a.filename, b.filename));
	const result: ProjectRecord[] = [];
	for (const f of sorted) {
		const rec = scanProjectNote(f, ctx);
		if (rec) result.push(rec);
	}
	return result;
}
