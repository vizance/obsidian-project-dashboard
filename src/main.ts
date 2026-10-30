import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';
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
			new Notice('設定儲存失敗，請再試一次');
		},
	});

	vaultSource!: VaultSource;

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
	}

	onunload(): void {}

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
