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
