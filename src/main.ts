import { Notice, Plugin, requestUrl, type WorkspaceLeaf } from 'obsidian';
import { CalendarStore } from './calendar-store';
import { PluginDataStore } from './core/plugin-data-store';
import type { PluginData } from './core/settings';
import { DashboardSettingTab } from './settings-tab';
import { VaultSource } from './vault-source';
import { ProjectDashboardView, VIEW_TYPE_DASHBOARD } from './view';

export type { PluginData };

export default class ProjectDashboardPlugin extends Plugin {
	// 外掛資料的唯一入口；這個類別只把 Obsidian 的讀寫與計時器接上去。
	readonly store = new PluginDataStore({
		load: () => this.loadData(),
		save: (data) => this.saveData(data),
		timers: { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
		onSaveError: (err) => {
			console.error('[project-dashboard] 儲存設定失敗', err);
			new Notice(`Your settings couldn't be saved. Please try again.`);
		},
	});

	// 行事曆讀取的唯一入口，所有儀表板分頁共用一次讀取與一份結果。連結只在發請求
	// 的那一刻從密鑰儲存區拿出來，不寫進外掛資料，也不進任何紀錄。
	readonly calendars = new CalendarStore({
		request: async (url) => {
			// throw: false 才拿得到 4xx／5xx 的狀態碼，由 CalendarStore 對應成讀取失敗的原因。
			const response = await requestUrl({ url, method: 'GET', throw: false });
			return { status: response.status, text: response.text };
		},
		getSecret: (id) => this.app.secretStorage.getSecret(id),
		now: () => new Date(),
		calendars: () => this.store.data.settings.calendars,
	});

	vaultSource!: VaultSource;

	private unsubscribeStore: (() => void) | null = null;

	async onload(): Promise<void> {
		await this.store.init();

		this.vaultSource = new VaultSource(
			this.app.vault,
			() => this.store.data.categoryOverrides,
			() => this.store.data.settings,
		);
		this.vaultSource.registerVaultEvents(this);

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf: WorkspaceLeaf) => new ProjectDashboardView(leaf, this.vaultSource, this));

		this.addSettingTab(new DashboardSettingTab(this.app, this));

		this.addRibbonIcon('calendar-range', 'Open project dashboard', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open-dashboard',
			name: 'Open dashboard',
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: 'refresh-calendars',
			name: 'Refresh calendars',
			callback: () => {
				void this.calendars.refresh();
			},
		});

		// 記憶體裡的 calendars 跟上次讀取用的不一樣時才重新讀取：存檔後、從外部重新
		// 載入後、存檔失敗還原後各問一次（design.md：讀取時機只有四種）。設定頁打字
		// 的過程中不會讀取，因為存檔本身已經延後合併。
		this.unsubscribeStore = this.store.subscribe((reason) => {
			if (reason !== 'settings-saved' && reason !== 'reloaded' && reason !== 'settings-reverted') return;
			void this.calendars.refreshIfCalendarsChanged();
		});
	}

	onunload(): void {
		this.unsubscribeStore?.();
		this.unsubscribeStore = null;
		// 讀到的行程只在記憶體裡，卸載就丟掉；還在路上的回應也不再通知任何分頁。
		this.calendars.dispose();
	}

	// Obsidian 回報外掛資料被外部改掉（Obsidian Sync 帶來另一台裝置的修改）。
	async onExternalSettingsChange(): Promise<void> {
		await this.store.reloadFromOutside();
	}

	private async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			this.app.workspace.setActiveLeaf(existing, { focus: true });
			return;
		}

		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD, active: true });
		await this.app.workspace.revealLeaf(leaf);
	}
}
