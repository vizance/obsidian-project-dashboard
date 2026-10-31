export interface WeekInfo {
	week: number;
	label: string;
	start: Date;
	end: Date;
	month: number;
	isMonthStart: boolean;
	isQuarterStart: boolean;
}

function isoWeekStart(year: number, week: number): Date {
	const jan4 = new Date(Date.UTC(year, 0, 4));
	const jan4Day = (jan4.getUTCDay() + 6) % 7;
	const week1Monday = new Date(jan4);
	week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
	const d = new Date(week1Monday);
	d.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
	return d;
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function formatISODate(d: Date): string {
	return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function addDaysISO(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return formatISODate(d);
}

// 把 "YYYY-Wnn" 標籤還原成那週星期一的 ISO 日期；對任何年份（含 W53、跨年）都成立，
// 因為直接重用 isoWeekStart 的算法，而不是只處理當年。
export function mondayOfWeek(weekLabel: string): string {
	const m = /^(\d{4})-W(\d{2})$/.exec(weekLabel);
	if (!m) throw new Error(`invalid week label: ${weekLabel}`);
	const year = Number(m[1]);
	const week = Number(m[2]);
	return formatISODate(isoWeekStart(year, week));
}

// 星期的中文單字，索引與 Date#getUTCDay() 一致（0 = 星期日）。
const WEEKDAY_CHARS = ['日', '一', '二', '三', '四', '五', '六'];

// M/D，不補零（規格的 10/26、11/1、10/30）。
export function monthDayLabel(iso: string): string {
	const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
	if (!m) throw new Error(`invalid ISO date: ${iso}`);
	return `${Number(m[1])}/${Number(m[2])}`;
}

export function weekdayChar(iso: string): string {
	const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
	if (Number.isNaN(day)) throw new Error(`invalid ISO date: ${iso}`);
	return WEEKDAY_CHARS[day]!;
}

// 浮窗任務列的日期標籤，例如 10/30（五）。
export function monthDayWeekdayLabel(iso: string): string {
	return `${monthDayLabel(iso)}（${weekdayChar(iso)}）`;
}

export function weekRangeLabel(weekLabel: string): string {
	const m = /^(\d{4})-W(\d{2})$/.exec(weekLabel);
	if (!m) throw new Error(`invalid week label: ${weekLabel}`);
	const week = m[2]!;
	const monday = mondayOfWeek(weekLabel);
	const sunday = addDaysISO(monday, 6);
	const fmt = monthDayLabel;
	// \u3000 is the full-width space the UI copy uses between the week and its range;
	// written as an escape so the separator stays visible to readers and linters.
	return `W${week}\u3000${fmt(monday)}（一）– ${fmt(sunday)}（日）`;
}

// 月視圖週表頭第二行與還沒排浮窗週按鈕的提示共用的 Monday–Sunday 區間，
// 例如 `10/26–11/1`（en dash，和規格一致）。兩邊只有一份格式，才不會寫成兩種。
export function weekRangeShort(weekLabel: string): string {
	const monday = mondayOfWeek(weekLabel);
	return `${monthDayLabel(monday)}–${monthDayLabel(addDaysISO(monday, 6))}`;
}

export function quarterOf(month: number): number {
	return Math.floor(month / 3) + 1;
}

// Never use toISOString() for "today": in Taipei, 00:00-08:00 local is still the
// previous UTC day, which would shift the highlighted week column by one.
export function todayLocal(now: Date = new Date()): string {
	const y = now.getFullYear();
	const m = now.getMonth() + 1;
	const d = now.getDate();
	return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// 一週屬於「它星期一落在的那個月」，只有 W01 例外：它的星期一可能在前一年的
// 12 月，但永遠算那個 ISO 年的一月（否則 2026 年的表頭會以一週的 12 月、Q4 開頭）。
// 年的最後一週的星期一一定在 12/22–12/28，所以只有 W01 的星期一會跨年。
// 月視圖（src/core/months.ts）用同一條規則，兩邊對同一週的說法才一致。
export function monthOfWeekStart(week: number, monday: Date): number {
	return week === 1 ? 0 : monday.getUTCMonth();
}

export function buildWeeks(year: number): WeekInfo[] {
	const raw: Array<{ week: number; start: Date; end: Date; month: number }> = [];
	for (let w = 1; w <= 53; w++) {
		const start = isoWeekStart(year, w);
		// 週數仍照 ISO 8601 以星期四所在的年份歸屬，年視圖的欄位因此完全不變；
		// 只有月份與季的分組改用星期一規則。
		const thursday = new Date(start);
		thursday.setUTCDate(start.getUTCDate() + 3);
		if (thursday.getUTCFullYear() > year) break;
		if (thursday.getUTCFullYear() < year) continue;
		const end = new Date(start);
		end.setUTCDate(start.getUTCDate() + 7);
		raw.push({ week: w, start, end, month: monthOfWeekStart(w, start) });
	}
	return raw.map((w, i) => ({
		week: w.week,
		label: `${year}-W${String(w.week).padStart(2, '0')}`,
		start: w.start,
		end: w.end,
		month: w.month,
		isMonthStart: i === 0 || raw[i - 1]!.month !== w.month,
		isQuarterStart: i === 0 || quarterOf(raw[i - 1]!.month) !== quarterOf(w.month),
	}));
}

export function groupQuarters(weeks: WeekInfo[]): Array<{ q: number; count: number }> {
	const result: Array<{ q: number; count: number }> = [];
	for (const w of weeks) {
		const q = quarterOf(w.month);
		const last = result[result.length - 1];
		if (last && last.q === q) last.count++;
		else result.push({ q, count: 1 });
	}
	return result;
}

export function groupMonths(weeks: WeekInfo[]): Array<{ month: number; count: number }> {
	const result: Array<{ month: number; count: number }> = [];
	for (const w of weeks) {
		const last = result[result.length - 1];
		if (last && last.month === w.month) last.count++;
		else result.push({ month: w.month, count: 1 });
	}
	return result;
}

export function todayWeekIndex(weeks: WeekInfo[], today: string): number {
	const d = new Date(`${today}T00:00:00Z`);
	return weeks.findIndex((w) => d >= w.start && d < w.end);
}

// 週對應需要的設定。DashboardSettings 也符合這個形狀，可以直接傳整份設定進來。
export interface WeekRules {
	saturdayCountsAsNextWeek: boolean;
}

export interface TaskDateWeek {
	label: string;
	isBumpedSat: boolean;
}

function parseStrictISODate(dateStr: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
	if (!m) return null;
	const y = Number(m[1]);
	const mo = Number(m[2]);
	const da = Number(m[3]);
	const d = new Date(Date.UTC(y, mo - 1, da));
	// Date.UTC 會把 2 月 30 日之類的日期滾到下個月，所以要回頭比對三個欄位，
	// 真的不存在的日期才算無效。
	if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== da) return null;
	return d;
}

// 某日期所在的 ISO 週標籤，不套用任何任務規則。週六規則、月份規則、月視圖的
// 「今天這週」都建立在這個函式上，ISO 週數的算法才只有一份。
export function isoWeekLabelOfDate(date: Date): string {
	const t = new Date(date);
	// ISO 8601 週數：以該週星期四所在的年份歸屬。
	t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// 日期無效時回傳 null。
export function isoWeekOfDate(dateStr: string): string | null {
	const d = parseStrictISODate(dateStr);
	return d ? isoWeekLabelOfDate(d) : null;
}

// 從某週的標籤造出 WeekInfo。buildWeeks 只需要今年的週，月視圖的 weeksOfMonth
// 需要任何年份的週（例如 2026 年 1 月的 W01，星期一在 2025 年），兩邊的欄位
// 算法因此共用這一份。
export function weekInfoFor(
	weekLabel: string,
	month: number,
	isMonthStart: boolean,
	isQuarterStart: boolean,
): WeekInfo {
	const m = /^(\d{4})-W(\d{2})$/.exec(weekLabel);
	if (!m) throw new Error(`invalid week label: ${weekLabel}`);
	const start = new Date(`${mondayOfWeek(weekLabel)}T00:00:00Z`);
	const end = new Date(start);
	end.setUTCDate(start.getUTCDate() + 7);
	return { week: Number(m[2]), label: weekLabel, start, end, month, isMonthStart, isQuarterStart };
}

// 任務日期套用 occupied 規則後對應到的 ISO 週：Mon–Fri 與 Sun 一律算當週；
// Sat 只有在 `saturdayCountsAsNextWeek` 開啟時才算下一週（+2 天才會跨週，
// 因為 ISO 週結束在星期日）。沒有任何星期被排除。日期無效時回傳 null。
// 掃描、年視圖格子、提示文字、浮窗都共用這一個函式，週六規則才只有一份。
export function weekOfTaskDate(dateStr: string, rules: WeekRules): TaskDateWeek | null {
	const d = parseStrictISODate(dateStr);
	if (!d) return null;
	const day = d.getUTCDay(); // Sun=0, Mon=1, ..., Fri=5, Sat=6
	const isBumpedSat = day === 6 && rules.saturdayCountsAsNextWeek;
	const t = new Date(d);
	if (isBumpedSat) t.setUTCDate(t.getUTCDate() + 2);
	return { label: isoWeekLabelOfDate(t), isBumpedSat };
}
