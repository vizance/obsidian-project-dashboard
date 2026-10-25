import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { VaultSource } from './vault-source';
import { ProjectDashboardView, VIEW_TYPE_DASHBOARD } from './view';

export interface PluginData {
	categoryOverrides: Record<string, string>;
}

function isPlainStringRecord(value: unknown): value is Record<string, string> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	return Object.values(value).every((v) => typeof v === 'string');
}

function normalizePluginData(raw: unknown): PluginData {
	if (typeof raw !== 'object' || raw === null) return { categoryOverrides: {} };
	const candidate = (raw as { categoryOverrides?: unknown }).categoryOverrides;
	return { categoryOverrides: isPlainStringRecord(candidate) ? candidate : {} };
}

export default class ProjectDashboardPlugin extends Plugin {
	data: PluginData = { categoryOverrides: {} };
	vaultSource!: VaultSource;

	async onload(): Promise<void> {
		this.data = normalizePluginData(await this.loadData());

		this.vaultSource = new VaultSource(this.app.vault, () => this.data.categoryOverrides);
		this.vaultSource.registerVaultEvents(this);

		this.registerView(VIEW_TYPE_DASHBOARD, (leaf: WorkspaceLeaf) => new ProjectDashboardView(leaf, this.vaultSource, this));

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
