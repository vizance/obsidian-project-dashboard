import { normalizeCalendarAddress, parseCalendar, type CalendarSource, type ParsedCalendar } from './core/calendar';
import type { CalendarSetting } from './core/settings';

// 讀不到行事曆的原因。全部只提到行事曆的顯示名稱，絕不提到連結：連結等同讀取
// 密碼，不能出現在畫面文字、提示、紀錄裡（design.md：行事曆連結存在 SecretStorage）。
export const SECRET_MISSING_REASON = '這台裝置找不到連結';
export const UNREACHABLE_REASON = '連不上';
export const UNREADABLE_REASON = '內容看不懂';

export function httpFailureReason(status: number): string {
	return `讀取失敗（HTTP ${status}）`;
}

export interface CalendarResponse {
	status: number;
	text: string;
}

export interface CalendarFailure {
	displayName: string;
	reason: string;
}

/**
 * 讀取狀態的快照。`sources` 的形狀可以直接交給 `occurrencesInRange`。
 */
export interface CalendarStoreState {
	running: boolean;
	// 這次外掛執行期間是否讀取過：還沒讀取前狀態列是空的。
	started: boolean;
	// 上一次讀取結束的本地時間 `HH:MM`，還沒結束過就是 null。
	finishedAt: string | null;
	failures: CalendarFailure[];
	sources: CalendarSource[];
}

export interface CalendarStoreOptions {
	// 正式環境接 Obsidian 的 requestUrl（GET、throw: false），測試用假的實作。
	request(url: string): Promise<CalendarResponse>;
	// 正式環境接 app.secretStorage.getSecret；沒有存值時回傳 null。
	getSecret(id: string): string | null;
	now(): Date;
	// 每次讀取都重新問一次設定：排著的下一次讀取要用那時候的設定。
	calendars(): readonly CalendarSetting[];
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

// 顯示名稱：取好的名字，沒取名就用它在設定清單裡的位置（1 起算）。
function displayName(calendar: CalendarSetting, index: number): string {
	const name = calendar.name.trim();
	return name === '' ? `行事曆 ${index + 1}` : name;
}

/**
 * 外掛層級的單一行事曆讀取器，所有儀表板分頁共用一次讀取與一份結果。
 *
 * 網路請求、取得鑰匙、時鐘都由建構時注入，所以測試完全不連網也不需要 Obsidian。
 * 結果只放在記憶體，`dispose()` 之後就丟掉。
 */
export class CalendarStore {
	// 上次成功解析的內容，用鑰匙 ID 對應而不是清單位置：刪掉或換掉鑰匙的行事曆，
	// 在下一次讀取時丟掉它的內容，其他行事曆不受影響。
	private readonly retained = new Map<string, ParsedCalendar>();
	// 上一次讀取用的設定；畫面上的位置與顯示名稱都照這一份算。
	private lastUsed: readonly CalendarSetting[] = [];
	private hasRun = false;
	private runningFlag = false;
	private startedFlag = false;
	private finishedAt: string | null = null;
	private failures: CalendarFailure[] = [];
	private readonly listeners = new Set<() => void>();
	// 進行中的那一串讀取（含它排著的下一次）；沒有讀取時是 null。
	private chain: Promise<void> | null = null;
	private queued = false;
	private disposed = false;

	constructor(private readonly options: CalendarStoreOptions) {}

	get state(): CalendarStoreState {
		const sources: CalendarSource[] = [];
		this.lastUsed.forEach((calendar, index) => {
			if (calendar.secretId === '') return;
			const parsed = this.retained.get(calendar.secretId);
			if (!parsed) return;
			sources.push({ calendar: parsed, index, name: displayName(calendar, index) });
		});
		return {
			running: this.runningFlag,
			started: this.startedFlag,
			finishedAt: this.finishedAt,
			failures: this.failures.map((failure) => ({ ...failure })),
			sources,
		};
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * 讀取所有鑰匙不是空字串的行事曆。讀取進行中再被呼叫，只排一次後續讀取，
	 * 用那時的設定。回傳的 promise 等到這一串讀取（含排著的那一次）都結束。
	 */
	refresh(): Promise<void> {
		if (this.disposed) return Promise.resolve();
		if (this.chain) {
			// 連按幾次都只多跑一次：排著的那一次還沒開始，重複的要求就併進去。
			this.queued = true;
			return this.chain;
		}
		// 讀取本體排到下一個 microtask 才開始，`this.chain` 一定先指好：讀取開始的
		// 通知讓訂閱者馬上又呼叫 refresh() 時，那一次才會併成排著的下一次。
		const chain = Promise.resolve()
			.then(async () => {
				await this.runOnce();
				while (this.queued && !this.disposed) {
					this.queued = false;
					await this.runOnce();
				}
			})
			.finally(() => {
				this.chain = null;
			});
		this.chain = chain;
		return chain;
	}

	/**
	 * 記憶體裡的 `calendars` 跟上次讀取用的不一樣時才讀取：外掛資料存檔後、從外部
	 * 重新載入後、存檔失敗還原後都會問一次（design.md：讀取時機只有四種）。
	 */
	refreshIfCalendarsChanged(): Promise<void> {
		if (this.disposed) return Promise.resolve();
		if (this.hasRun && sameCalendars(this.lastUsed, this.options.calendars())) return Promise.resolve();
		return this.refresh();
	}

	// 外掛卸載時呼叫：之後才回來的回應、排著的下一次讀取都直接丟掉，也不通知任何人。
	dispose(): void {
		this.disposed = true;
		this.queued = false;
		this.retained.clear();
		this.listeners.clear();
	}

	private async runOnce(): Promise<void> {
		const snapshot = this.options.calendars().map((calendar) => ({ ...calendar }));
		this.lastUsed = snapshot;
		this.hasRun = true;
		this.forgetRemoved(snapshot);
		const targets = snapshot
			.map((calendar, index) => ({ calendar, index }))
			// 鑰匙空白的是使用者還沒填完的一列：跳過，不發請求也不回報原因。
			.filter((target) => target.calendar.secretId !== '');
		// 沒有任何行事曆設了鑰匙就完全不連網，狀態也維持「還沒讀取過」。
		if (targets.length === 0) return;

		this.runningFlag = true;
		this.startedFlag = true;
		this.notify();

		const results = await Promise.all(targets.map((target) => this.fetchOne(target.calendar, target.index)));
		if (this.disposed) return;
		this.runningFlag = false;
		this.finishedAt = formatTime(this.options.now());
		// 照設定清單的順序回報，提示列出來的次序才跟設定頁一致。
		this.failures = results.filter((result): result is CalendarFailure => result !== null);
		this.notify();
	}

	// 一個行事曆讀成功就換掉它的內容，失敗就保留上次成功的內容並回報原因。
	private async fetchOne(calendar: CalendarSetting, index: number): Promise<CalendarFailure | null> {
		const fail = (reason: string): CalendarFailure => ({ displayName: displayName(calendar, index), reason });
		// 空字串跟沒有存值一樣：這把鑰匙在這台裝置上沒有連結可用。
		const secret = this.options.getSecret(calendar.secretId);
		if (secret === null || secret === '') return fail(SECRET_MISSING_REASON);
		const address = normalizeCalendarAddress(secret);
		if (!address.ok) return fail(address.reason);

		let response: CalendarResponse;
		try {
			response = await this.options.request(address.url);
		} catch {
			// 錯誤物件可能帶著網址，所以連它都不看，只回報原因。
			return fail(UNREACHABLE_REASON);
		}
		if (response.status < 200 || response.status > 299) return fail(httpFailureReason(response.status));

		let parsed: ParsedCalendar;
		try {
			parsed = parseCalendar(response.text);
		} catch {
			return fail(UNREADABLE_REASON);
		}
		// 卸載後才回來的回應整個丟掉，不留在記憶體裡。
		if (this.disposed) return null;
		this.retained.set(calendar.secretId, parsed);
		return null;
	}

	private forgetRemoved(snapshot: readonly CalendarSetting[]): void {
		const kept = new Set(snapshot.map((calendar) => calendar.secretId));
		for (const secretId of Array.from(this.retained.keys())) {
			if (!kept.has(secretId)) this.retained.delete(secretId);
		}
	}

	private notify(): void {
		if (this.disposed) return;
		// 複製一份再跑：監聽器在收到通知時可能取消訂閱（分頁關掉就會）。
		for (const listener of Array.from(this.listeners)) listener();
	}
}

function formatTime(now: Date): string {
	return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

// 逐列比值：名稱或鑰匙改了、順序換了、列數變了都算不一樣。
function sameCalendars(a: readonly CalendarSetting[], b: readonly CalendarSetting[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((calendar, i) => calendar.name === b[i]?.name && calendar.secretId === b[i]?.secretId);
}
