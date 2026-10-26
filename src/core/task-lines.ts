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
// 完成標記要「✅ 後面接日期」才算，與 scan.ts 的完成判斷相同；[[✅ 已完成的筆記]] 只是連結。
const DONE_MARKER_RE = /✅\s+\d{4}-\d{2}-\d{2}/;
// 像日期標記的東西：任何 📅，或 ✅ 後面（可能隔著 U+FE0F 與空白）接數字。解析不出日期的
// 變形標記也算，這種行不再自動補日期，以免同一行出現兩個日期。
const DATE_LIKE_MARKER_RE = /📅|✅\uFE0F?\s*\d/;
// 區塊 ID 連同它後面的空白一起抓，新標記才會插在 ID 之前、而 ID 與尾端空白
// 留在行尾（dashboard-task-editing：the block reference and its trailing
// whitespace SHALL stay at the end of the line）。
const BLOCK_ID_RE = /(\s\^[A-Za-z0-9-]+\s*)$/;

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

// 哪幾行屬於「照抄不動」的區塊：開頭的 YAML frontmatter 與圍欄程式碼區塊。
// 這些行裡的 `- [ ]` 是文件內容而不是任務，勾了會改壞 frontmatter 或範例，
// 所以掃描與插入新任務都要跳過它們。圍欄只能被同一種圍欄字元關閉（``` 不會
// 被 ~~~ 關掉），而且圍欄那一行本身也算在區塊內。
export function readOnlyLineFlags(lines: string[]): boolean[] {
	const flags = lines.map(() => false);
	let i = 0;

	// frontmatter 只認「第 0 行就是 ---」，兩道分隔線都算在裡面；沒有收尾的
	// 分隔線時整則筆記都算 frontmatter（Obsidian 也不會把它當內容）。
	if (lines.length > 0 && lines[0]!.trim() === '---') {
		for (i = 0; i < lines.length; i++) {
			flags[i] = true;
			if (i > 0 && lines[i]!.trim() === '---') {
				i++;
				break;
			}
		}
	}

	let fence: '`' | '~' | null = null;
	for (; i < lines.length; i++) {
		const trimmed = lines[i]!.trim();
		const marker = trimmed.startsWith('```') ? '`' : trimmed.startsWith('~~~') ? '~' : null;
		if (fence === null) {
			if (marker !== null) {
				fence = marker;
				flags[i] = true;
			}
			continue;
		}
		flags[i] = true;
		if (marker === fence) fence = null;
	}
	return flags;
}

export function parseTaskLines(text: string): TaskLine[] {
	const rawLines = text.split(/\r\n|\r|\n/);
	const readOnly = readOnlyLineFlags(rawLines);
	const result: TaskLine[] = [];
	for (let i = 0; i < rawLines.length; i++) {
		const raw = rawLines[i]!;
		const trimmed = raw.trim();
		const checkboxMatch = CHECKBOX_RE.exec(trimmed);
		// 區塊內的行永遠不是核取方塊任務：有日期才會進清單，而且唯讀。
		const checkbox = checkboxMatch !== null && !readOnly[i]!;
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
			done: checkedBox || DONE_MARKER_RE.test(raw),
			due: dueMarker ? dueMarker[2]! : null,
			doneDate: doneMarker ? doneMarker[2]! : null,
			recurring: raw.includes('🔁'),
			dates: markers.map((m) => m[2]!),
		});
	}
	return result;
}

export function hasDateLikeMarker(raw: string): boolean {
	return DATE_LIKE_MARKER_RE.test(raw);
}

// 行裡有像日期標記的東西就不當成「還沒排日期」：變形或打壞的標記（例如
// `📅️ 2026-11-06`，日曆後面多了 U+FE0F）解析不出日期，但再排一次會變成
// 同一行有兩個日期，寧可留給使用者自己在筆記裡修。
export function unscheduledTasks(lines: TaskLine[]): TaskLine[] {
	return lines.filter((l) => l.checkbox && !l.done && l.dates.length === 0 && !hasDateLikeMarker(l.raw));
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
	const isDone = checkedBox || DONE_MARKER_RE.test(rest);

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
	const readOnly = readOnlyLineFlags(lines);
	let lastIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		// 範例程式碼與 frontmatter 裡的核取方塊不算任務，新任務不能跟在它們後面。
		if (!readOnly[i]! && checkboxLineRe.test(lines[i]!)) lastIdx = i;
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
