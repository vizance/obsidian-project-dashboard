import { normalizePluginData, normalizeSettings, type DashboardSettings, type PluginData } from './settings';
import { createDebouncer } from './sync-rules';

// 設定修改延後存檔的毫秒數：與筆記重掃的 debounce 相同，一連串修改只存一次、
// 只重新掃描一次（design.md：設定頁打字時一直重新掃描，造成卡頓）。
export const SETTINGS_SAVE_DELAY_MS = 400;

// 訂閱者要能分辨發生了什麼：儀表板只在設定存檔成功與重新載入時重掃，設定頁則
// 在還原與重新載入時重畫。
export type PluginDataChangeReason = 'settings-saved' | 'settings-reverted' | 'overrides-saved' | 'reloaded';

export type PluginDataListener = (reason: PluginDataChangeReason) => void;

// 與 src/core/sync-rules.ts 的 createDebouncer 相同形狀：注入計時器，核心才不必
// 認識 window。
interface Timers {
	set(fn: () => void, ms: number): number;
	clear(id: number): void;
}

export interface PluginDataStoreOptions {
	load(): Promise<unknown>;
	save(data: PluginData): Promise<void>;
	timers: Timers;
	// 存設定失敗時回報給外掛（Obsidian 的 Notice 在這一層之外）。
	onSaveError(err: unknown): void;
}

// 再 normalize 一次就是一份不共用陣列的深拷貝：normalize 對已經檢查過的資料是
// 幂等的，所以不需要另一套 clone 規則。
function copy(data: PluginData): PluginData {
	return normalizePluginData(data);
}

// 外掛資料的唯一入口：載入、檢查、合併存檔、失敗還原、外部變更都在這裡，
// src/main.ts 只負責把 Obsidian 的 loadData／saveData 接上來。
export class PluginDataStore {
	private current: PluginData = normalizePluginData(undefined);
	// 上次存成功的值；存檔失敗時設定還原成這一份。
	private lastSaved: PluginData = normalizePluginData(undefined);
	private readonly listeners = new Set<PluginDataListener>();
	private readonly debouncer: { trigger(): void; cancel(): void };
	// 每次外部變更就加一：重新載入前就送出、之後才回來的存檔結果要整個作廢，
	// 否則被蓋掉的修改會在那個時候又變成「上次存成功的值」。
	private generation = 0;

	constructor(private readonly options: PluginDataStoreOptions) {
		this.debouncer = createDebouncer(SETTINGS_SAVE_DELAY_MS, options.timers, () => {
			void this.flushSettings();
		});
	}

	async init(): Promise<void> {
		this.replaceAll(await this.options.load());
	}

	get data(): PluginData {
		return this.current;
	}

	// 記憶體中的設定立刻換成檢查過的新值（掃描馬上就用它），存檔延後合併。
	updateSettings(next: DashboardSettings): void {
		this.current = { categoryOverrides: this.current.categoryOverrides, settings: normalizeSettings(next) };
		this.debouncer.trigger();
	}

	// 手動分類維持立即寫入，失敗往外拋，由儀表板顯示既有的提示並復原下拉選單。
	async saveCategoryOverrides(next: Record<string, string>): Promise<void> {
		const data = normalizePluginData({ categoryOverrides: next, settings: this.current.settings });
		await this.options.save(data);
		this.current = { categoryOverrides: data.categoryOverrides, settings: this.current.settings };
		this.lastSaved = copy(data);
		this.notify('overrides-saved');
	}

	// Obsidian 回報外掛資料被外部改掉（例如 Obsidian Sync 帶來另一台裝置的修改）：
	// 同步過來的值優先，還沒存的修改丟掉，而且之後也不會再被寫回去。
	async reloadFromOutside(): Promise<void> {
		this.debouncer.cancel();
		this.generation++;
		this.replaceAll(await this.options.load());
		this.notify('reloaded');
	}

	subscribe(listener: PluginDataListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private replaceAll(raw: unknown): void {
		// 檢查兩次而不是共用一份：記憶體中的資料被改到時，「上次存成功的值」不能
		// 跟著變，否則還原就還原不回去了。
		this.current = normalizePluginData(raw);
		this.lastSaved = normalizePluginData(raw);
	}

	private async flushSettings(): Promise<void> {
		const generation = this.generation;
		// 永遠寫整份：只寫 settings 會把手動分類蓋掉，只寫 categoryOverrides 會把
		// 設定蓋掉（design.md：外掛資料一次寫整份）。
		const snapshot = copy(this.current);
		try {
			await this.options.save(snapshot);
		} catch (err) {
			if (generation !== this.generation) return;
			this.current = {
				categoryOverrides: this.current.categoryOverrides,
				settings: normalizeSettings(this.lastSaved.settings),
			};
			this.options.onSaveError(err);
			this.notify('settings-reverted');
			return;
		}
		if (generation !== this.generation) return;
		this.lastSaved = copy(snapshot);
		this.notify('settings-saved');
	}

	private notify(reason: PluginDataChangeReason): void {
		// 複製一份再跑：監聽器在收到通知時可能取消訂閱（設定頁重畫就會）。
		for (const listener of Array.from(this.listeners)) listener(reason);
	}
}
