import ICAL from 'ical.js';
import { addDaysISO, mondayOfWeek, monthDayWeekdayLabel } from './weeks';

// ical.js 的型別只從預設匯出的命名空間拿得到，所以這裡先取出實例型別。
// 整個檔案只在內部用它們；進出口一律用本專案自己定義的型別，其他檔案因此
// 完全不碰 ical.js 的物件，有型別檢查的 lint 也不會在別處遇到 any。
type IcalComponent = InstanceType<typeof ICAL.Component>;
type IcalTime = InstanceType<typeof ICAL.Time>;
type IcalDuration = InstanceType<typeof ICAL.Duration>;

export const INVALID_ADDRESS_REASON = '連結格式不對';

export type CalendarAddress =
	| { ok: true; url: string }
	| { ok: false; reason: typeof INVALID_ADDRESS_REASON };

/**
 * 解析好的行事曆。對呼叫端來說是不透明的：只有這個檔案讀得懂裡面的內容。
 */
export interface ParsedCalendar {
	readonly root: IcalComponent;
}

/**
 * 一個要展開的行事曆，連同它在設定清單裡的位置與顯示名稱。
 */
export interface CalendarSource {
	index: number;
	name: string;
	calendar: ParsedCalendar;
}

/**
 * 展開後的一次行程。`start` 與 `end` 都是裝置本地時間的字面值：整天行程寫成
 * `YYYY-MM-DD`，有時間的行程寫成 `YYYY-MM-DDTHH:MM`。`end` 不含在行程內。
 * 只留到分鐘，因為畫面與週的對應都只到分鐘；秒數不影響任何顯示。
 */
export interface EventOccurrence {
	uid: string;
	title: string;
	allDay: boolean;
	start: string;
	end: string;
	calendarIndex: number;
	calendarName: string;
}

const EMPTY_TITLE = '（沒有標題）';

// 一個行程最多檢查這麼多次，從它第一次發生開始算。每天重複、從幾十年前開始的
// 行程仍然算得到顯示中的月份，而寫壞的規則（例如每秒重複）不會讓畫面卡住。
const MAX_OCCURRENCES = 100000;

const MINUTES_PER_DAY = 1440;
const MS_PER_DAY = 86400000;

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

export function normalizeCalendarAddress(raw: string): CalendarAddress {
	const trimmed = raw.trim();
	if (trimmed.startsWith('https://')) return { ok: true, url: trimmed };
	// webcal 是同一個網址的另一種寫法，換掉協定其餘照原樣送出。
	if (trimmed.startsWith('webcal://')) {
		return { ok: true, url: `https://${trimmed.slice('webcal://'.length)}` };
	}
	return { ok: false, reason: INVALID_ADDRESS_REASON };
}

/**
 * 解讀 iCalendar 文字。看不懂時丟出錯誤，由上層對應成 `內容看不懂`。
 */
export function parseCalendar(text: string): ParsedCalendar {
	const root = ICAL.Component.fromString(text);
	if (root.name !== 'vcalendar') throw new Error('not an iCalendar object');
	// ical.js 不附時區資料庫，所以把這份行事曆自己帶的 VTIMEZONE 註冊起來，
	// 讀 DTSTART 時才找得到 TZID 的定義。沒有定義的 TZID 會被當成本地時間。
	for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
		const tzid = stringValue(vtimezone, 'tzid');
		if (tzid === '' || ICAL.TimezoneService.has(tzid)) continue;
		ICAL.TimezoneService.register(new ICAL.Timezone({ component: vtimezone, tzid }));
	}
	return { root };
}

/**
 * 展開並合併多個行事曆在 `[from, to)` 這段本地時間內的行程。`from` 與 `to`
 * 都是 `YYYY-MM-DD`，各代表那天的本地 00:00。
 */
export function occurrencesInRange(
	calendars: CalendarSource[],
	from: string,
	to: string,
): EventOccurrence[] {
	const rangeStart = wallMinutes(from);
	const rangeEnd = wallMinutes(to);
	const result: EventOccurrence[] = [];
	// 同一個 UID 加同一個開始時間只顯示一次，不論來自哪個行事曆。
	const seen = new Set<string>();
	for (const source of calendars) {
		for (const group of groupEvents(source.calendar.root).values()) {
			const overridden = new Set<string>();
			for (const override of group.overrides) {
				const recurrenceId = timeValue(override, 'recurrence-id');
				if (!recurrenceId) continue;
				// 主行程展開時要跳過被例外取代的那幾次，不論例外是取消還是改時間。
				overridden.add(occurrenceKey(recurrenceId));
				if (isCancelled(override)) continue;
				// 例外用它自己改過之後的時間比對顯示範圍，所以被移到別週也不會漏掉。
				collectSingle(override, source, rangeStart, rangeEnd, seen, result);
			}
			for (const master of group.masters) {
				if (isCancelled(master)) continue;
				collectRecurring(master, source, overridden, rangeStart, rangeEnd, seen, result);
			}
		}
	}
	return result;
}

/**
 * 某一週（週一 00:00 到下週一 00:00，本地時間）的行程，照規格排序。
 * 任務的週六規則不套用在行程上。
 */
export function occurrencesForWeek(
	occurrences: EventOccurrence[],
	weekLabel: string,
): EventOccurrence[] {
	const monday = mondayOfWeek(weekLabel);
	const weekStart = wallMinutes(monday);
	const weekEnd = wallMinutes(addDaysISO(monday, 7));
	return occurrences
		.filter((occurrence) => overlaps(occurrence, weekStart, weekEnd))
		.sort(compareOccurrences);
}

export function eventLineText(occurrence: EventOccurrence): string {
	const title = occurrence.title === '' ? EMPTY_TITLE : occurrence.title;
	const startDate = dateOf(occurrence.start);
	if (occurrence.allDay) {
		// 整天行程的結束日不含在行程內，所以最後一天是結束的前一天。
		const lastDay = addDaysISO(dateOf(occurrence.end), -1);
		if (lastDay <= startDate) return `${monthDayWeekdayLabel(startDate)}${title}`;
		return `${monthDayWeekdayLabel(startDate)}–${monthDayWeekdayLabel(lastDay)}${title}`;
	}
	const endDate = dateOf(occurrence.end);
	const startLabel = `${monthDayWeekdayLabel(startDate)}${timeOf(occurrence.start)}`;
	if (endDate === startDate) return `${startLabel} ${title}`;
	return `${startLabel}–${monthDayWeekdayLabel(endDate)}${timeOf(occurrence.end)} ${title}`;
}

interface EventGroup {
	masters: IcalComponent[];
	overrides: IcalComponent[];
}

function groupEvents(root: IcalComponent): Map<string, EventGroup> {
	const groups = new Map<string, EventGroup>();
	for (const vevent of root.getAllSubcomponents('vevent')) {
		const uid = stringValue(vevent, 'uid');
		let group = groups.get(uid);
		if (!group) {
			group = { masters: [], overrides: [] };
			groups.set(uid, group);
		}
		if (vevent.hasProperty('recurrence-id')) group.overrides.push(vevent);
		else group.masters.push(vevent);
	}
	return groups;
}

function collectSingle(
	vevent: IcalComponent,
	source: CalendarSource,
	rangeStart: number,
	rangeEnd: number,
	seen: Set<string>,
	out: EventOccurrence[],
): void {
	const dtstart = timeValue(vevent, 'dtstart');
	if (!dtstart) return;
	add(
		buildOccurrence(vevent, source, dtstart, eventDuration(vevent, dtstart)),
		rangeStart,
		rangeEnd,
		seen,
		out,
	);
}

function collectRecurring(
	master: IcalComponent,
	source: CalendarSource,
	overridden: Set<string>,
	rangeStart: number,
	rangeEnd: number,
	seen: Set<string>,
	out: EventOccurrence[],
): void {
	const dtstart = timeValue(master, 'dtstart');
	if (!dtstart) return;
	const duration = eventDuration(master, dtstart);
	// RecurExpansion 同時處理 RRULE、RDATE 與 EXDATE，沒有重複規則的行程也會
	// 回傳唯一的那一次，所以單次與重複共用這一條路徑。
	const expansion = new ICAL.RecurExpansion({ component: master, dtstart });
	let examined = 0;
	for (;;) {
		const next: IcalTime | null = expansion.next();
		if (!next) return;
		if (++examined > MAX_OCCURRENCES) return;
		if (overridden.has(occurrenceKey(next))) continue;
		const occurrence = buildOccurrence(master, source, next, duration);
		// 展開的順序是由早到晚，所以超出顯示範圍就可以停下來。
		if (wallMinutes(occurrence.start) >= rangeEnd) return;
		add(occurrence, rangeStart, rangeEnd, seen, out);
	}
}

function add(
	occurrence: EventOccurrence,
	rangeStart: number,
	rangeEnd: number,
	seen: Set<string>,
	out: EventOccurrence[],
): void {
	if (!overlaps(occurrence, rangeStart, rangeEnd)) return;
	const key = `${occurrence.uid}|${occurrence.start}`;
	if (seen.has(key)) return;
	seen.add(key);
	out.push(occurrence);
}

function buildOccurrence(
	vevent: IcalComponent,
	source: CalendarSource,
	start: IcalTime,
	duration: IcalDuration,
): EventOccurrence {
	const end = start.clone();
	end.addDuration(duration);
	return {
		uid: stringValue(vevent, 'uid'),
		title: stringValue(vevent, 'summary'),
		allDay: start.isDate,
		start: localValue(start),
		end: localValue(end),
		calendarIndex: source.index,
		calendarName: source.name,
	};
}

function eventDuration(vevent: IcalComponent, dtstart: IcalTime): IcalDuration {
	const dtend = timeValue(vevent, 'dtend');
	// 不看時區的相減：每一次重複都在同一個時區裡，照字面長度重複才對得上。
	if (dtend) return dtend.subtractDate(dtstart);
	const duration = durationValue(vevent, 'duration');
	if (duration) return duration;
	// 沒有結束也沒有長度：有時間的行程結束在開始的那一刻，整天行程算一天。
	return ICAL.Duration.fromData(dtstart.isDate ? { days: 1 } : {});
}

function isCancelled(vevent: IcalComponent): boolean {
	return stringValue(vevent, 'status').toUpperCase() === 'CANCELLED';
}

function stringValue(component: IcalComponent, name: string): string {
	const value = component.getFirstPropertyValue(name);
	return typeof value === 'string' ? value : '';
}

function timeValue(component: IcalComponent, name: string): IcalTime | null {
	const value = component.getFirstPropertyValue(name);
	return value instanceof ICAL.Time ? value : null;
}

function durationValue(component: IcalComponent, name: string): IcalDuration | null {
	const value = component.getFirstPropertyValue(name);
	return value instanceof ICAL.Duration ? value : null;
}

// 主行程的某一次與 RECURRENCE-ID 的對應鑰匙。用絕對時間而不是字面值，TZID 與
// UTC 寫法不同但指同一刻時也能對上。
function occurrenceKey(time: IcalTime): string {
	return `${time.isDate ? 'D' : 'T'}:${time.toUnixTime()}`;
}

function localValue(time: IcalTime): string {
	const date = `${time.year}-${pad2(time.month)}-${pad2(time.day)}`;
	if (time.isDate) return date;
	// 浮動時間（沒有 TZID，或 TZID 在這份行事曆裡沒有定義）照字面當成本地時間。
	// ical.js 把浮動時間當成 UTC，所以不能走 toJSDate()。
	if (time.zone === ICAL.Timezone.localTimezone) {
		return `${date}T${pad2(time.hour)}:${pad2(time.minute)}`;
	}
	const local = time.toJSDate();
	return [
		`${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`,
		`T${pad2(local.getHours())}:${pad2(local.getMinutes())}`,
	].join('');
}

function dateOf(value: string): string {
	return value.slice(0, 10);
}

function timeOf(value: string): string {
	return value.slice(11, 16);
}

function dayNumber(date: string): number {
	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(5, 7));
	const day = Number(date.slice(8, 10));
	return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

// 本地時間的字面值換成可比較的分鐘數。週的界線是本地午夜，所以用字面時間比較
// 就是規格說的本地時間比較，也不會被日光節約時間影響。
function wallMinutes(value: string): number {
	const minutes = value.length > 10 ? Number(timeOf(value).slice(0, 2)) * 60 + Number(timeOf(value).slice(3, 5)) : 0;
	return dayNumber(dateOf(value)) * MINUTES_PER_DAY + minutes;
}

function overlaps(occurrence: EventOccurrence, rangeStart: number, rangeEnd: number): boolean {
	const start = wallMinutes(occurrence.start);
	// 結束等於開始的行程算在開始那一刻所在的區間，否則半開區間永遠不重疊。
	const end = Math.max(wallMinutes(occurrence.end), start + 1);
	return start < rangeEnd && end > rangeStart;
}

function compareOccurrences(a: EventOccurrence, b: EventOccurrence): number {
	const byDate = dayNumber(dateOf(a.start)) - dayNumber(dateOf(b.start));
	if (byDate !== 0) return byDate;
	// 同一天，整天行程排在有時間的行程前面。
	if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
	const byTime = wallMinutes(a.start) - wallMinutes(b.start);
	if (byTime !== 0) return byTime;
	if (a.calendarIndex !== b.calendarIndex) return a.calendarIndex - b.calendarIndex;
	if (a.title === b.title) return 0;
	return a.title < b.title ? -1 : 1;
}
