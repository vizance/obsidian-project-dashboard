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

export function buildWeeks(year: number): WeekInfo[] {
	const raw: Array<{ week: number; start: Date; end: Date; month: number }> = [];
	for (let w = 1; w <= 53; w++) {
		const start = isoWeekStart(year, w);
		const thursday = new Date(start);
		thursday.setUTCDate(start.getUTCDate() + 3);
		if (thursday.getUTCFullYear() > year) break;
		if (thursday.getUTCFullYear() < year) continue;
		const end = new Date(start);
		end.setUTCDate(start.getUTCDate() + 7);
		raw.push({ week: w, start, end, month: thursday.getUTCMonth() });
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

// 把任務日期套用 occupied 規則後對應到的 ISO 週標籤，回傳 {label, isBumpedSat}
// 規則：Mon-Fri / Sun → 當週；Sat → 下一週。沒有任何星期被排除。
export function taskDateToWeekLabel(dateStr: string): { label: string; isBumpedSat: boolean } {
	const d = new Date(`${dateStr}T00:00:00Z`);
	const day = d.getUTCDay(); // Sun=0, Mon=1, ..., Fri=5, Sat=6
	const target = new Date(d);
	if (day === 6) target.setUTCDate(target.getUTCDate() + 2); // Sat → 下週 Mon
	// ISO 8601 週數：以 target 所在週的星期四歸屬年
	const t = new Date(target);
	t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return { label: `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, isBumpedSat: day === 6 };
}
