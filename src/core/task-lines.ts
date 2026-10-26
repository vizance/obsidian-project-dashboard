import { addDaysISO, mondayOfWeek, taskDateToWeekLabel } from './weeks';

export interface TaskLine {
	line: number;
	raw: string;
	text: string;
	checkbox: boolean;
	done: boolean;
	due: string | null;
	doneDate: string | null;
	recurring: boolean;
	dates: string[];
}

// 任務標記：📅（預計）或 ✅（完成）後接 ISO 日期。
const TASK_MARKER_RE = /(📅|✅)\s+(\d{4}-\d{2}-\d{2})/g;
// 核取方塊只認 [ ]、[x]、[X]；套用在已 trim 過的行上。
const CHECKBOX_RE = /^[-*+]\s+\[([ xX])\]/;
// 行首 bullet / checkbox 前綴，供顯示文字清理用。
const BULLET_RE = /^[-*+]\s+(?:\[[ xX]\]\s+)?/;
const BLOCK_ID_RE = /(\s\^[A-Za-z0-9-]+)$/;

// 與既有 parseTasks 共用的清理規則：移除 bullet／checkbox、裁掉 " > " 之後、
// 移除日期標記、收合空白。從 src/core/scan.ts 搬來，避免 scan.ts 與本檔互相 import。
export function cleanTaskText(line: string): string {
	let s = line.trim().replace(BULLET_RE, '');
	const cut = s.indexOf(' > ');
	if (cut !== -1) {
		s = s.slice(0, cut);
	}
	s = s.replace(TASK_MARKER_RE, '');
	return s.replace(/\s+/g, ' ').trim();
}

export function parseTaskLines(text: string): TaskLine[] {
	const rawLines = text.split(/\r\n|\r|\n/);
	const result: TaskLine[] = [];
	for (let i = 0; i < rawLines.length; i++) {
		const raw = rawLines[i]!;
		const trimmed = raw.trim();
		const checkboxMatch = CHECKBOX_RE.exec(trimmed);
		const checkbox = checkboxMatch !== null;
		const markers = Array.from(raw.matchAll(TASK_MARKER_RE));
		if (!checkbox && markers.length === 0) continue;

		const checkedBox = checkboxMatch !== null && (checkboxMatch[1] === 'x' || checkboxMatch[1] === 'X');
		const dueMarker = markers.find((m) => m[1] === '📅');
		const doneMarker = markers.find((m) => m[1] === '✅');

		result.push({
			line: i,
			raw,
			text: cleanTaskText(raw),
			checkbox,
			done: checkedBox || raw.includes('✅'),
			due: dueMarker ? dueMarker[2]! : null,
			doneDate: doneMarker ? doneMarker[2]! : null,
			recurring: raw.includes('🔁'),
			dates: markers.map((m) => m[2]!),
		});
	}
	return result;
}

export function unscheduledTasks(lines: TaskLine[]): TaskLine[] {
	return lines.filter((l) => l.checkbox && !l.done && l.dates.length === 0);
}

function earliestDateForWeek(line: TaskLine, weekLabel: string): string {
	const matching = line.dates.filter((d) => taskDateToWeekLabel(d).label === weekLabel).sort();
	return matching[0]!;
}

export function taskLinesForWeek(lines: TaskLine[], weekLabel: string): TaskLine[] {
	const matched = lines.filter((l) => l.dates.some((d) => taskDateToWeekLabel(d).label === weekLabel));
	return [...matched].sort((a, b) => {
		const ea = earliestDateForWeek(a, weekLabel);
		const eb = earliestDateForWeek(b, weekLabel);
		if (ea !== eb) return ea < eb ? -1 : 1;
		return a.line - b.line;
	});
}

export function toggleDoneLine(raw: string, today: string): string {
	const m = /^(\s*[-*+]\s+)\[([ xX])\](.*)$/.exec(raw);
	if (!m) return raw;
	const prefix = m[1]!;
	const checkboxChar = m[2]!;
	const rest = m[3]!;
	const checkedBox = checkboxChar === 'x' || checkboxChar === 'X';
	const isDone = checkedBox || rest.includes('✅');

	if (isDone) {
		const opened = rest.replace(/\s*✅\s+\d{4}-\d{2}-\d{2}/g, '');
		return `${prefix}[ ]${opened}`;
	}

	const blockIdMatch = BLOCK_ID_RE.exec(rest);
	if (blockIdMatch) {
		const blockId = blockIdMatch[1]!;
		const before = rest.slice(0, rest.length - blockId.length);
		return `${prefix}[x]${before} ✅ ${today}${blockId}`;
	}
	return `${prefix}[x]${rest} ✅ ${today}`;
}

export function shiftDueLine(raw: string, days: number): string {
	const re = /📅\s+(\d{4}-\d{2}-\d{2})/;
	return raw.replace(re, (full, date: string) => full.replace(date, addDaysISO(date, days)));
}

export function scheduleLine(raw: string, date: string): string {
	const blockIdMatch = BLOCK_ID_RE.exec(raw);
	if (blockIdMatch) {
		const blockId = blockIdMatch[1]!;
		const before = raw.slice(0, raw.length - blockId.length);
		return `${before} 📅 ${date}${blockId}`;
	}
	return `${raw} 📅 ${date}`;
}

export function buildNewTaskLine(text: string, date: string): string | null {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed === '') return null;
	const hasOwnDate = /📅\s+\d{4}-\d{2}-\d{2}/.test(collapsed);
	return hasOwnDate ? `- [ ] ${collapsed}` : `- [ ] ${collapsed} 📅 ${date}`;
}

export function newTaskInsertIndex(lines: string[]): number {
	const checkboxLineRe = /^\s*[-*+]\s+\[[ xX]\]/;
	let lastIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (checkboxLineRe.test(lines[i]!)) lastIdx = i;
	}
	return lastIdx === -1 ? lines.length : lastIdx + 1;
}

export function locateLine(lines: string[], index: number, expected: string): number {
	if (index >= 0 && index < lines.length && lines[index] === expected) return index;
	const matches: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (lines[i] === expected) matches.push(i);
	}
	return matches.length === 1 ? matches[0]! : -1;
}

// 排進某週固定寫星期五（星期一 + 4 天）；換週固定 7 天，讓星期不變。
// 之後開放設定（排進某週寫星期幾、週六算下一週）時，這兩個常數會跟
// taskDateToWeekLabel 的週六規則一起收斂到同一處設定。
const SCHEDULE_WEEKDAY_OFFSET_DAYS = 4;
export const SHIFT_WEEK_DAYS = 7;

export function scheduleDateForWeek(weekLabel: string): string {
	return addDaysISO(mondayOfWeek(weekLabel), SCHEDULE_WEEKDAY_OFFSET_DAYS);
}
