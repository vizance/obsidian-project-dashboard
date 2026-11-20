import { App, ItemView, setCalendarResponses } from 'obsidian';
import ProjectDashboardPlugin from '../../../src/main';
import { DashboardSettingTab } from '../../../src/settings-tab';
import { VIEW_TYPE_DASHBOARD } from '../../../src/view';
import { calendarResponses, calendarSecrets, demoPluginData, projects } from './fixtures';

async function main(): Promise<void> {
	const root = document.querySelector<HTMLElement>('#screenshot-root');
	if (!root) throw new Error('找不到展示頁容器');
	const app = new App(root);
	app.pluginData = demoPluginData();
	app.saveLocalStorage('dashboard.helpFirstSeen', 'true');
	app.saveLocalStorage('dashboard.helpPanelOpen', 'false');
	const folder = app.vault.addFolder('Projects');
	for (const project of projects) app.vault.addFile(folder, project.filename, project.text);
	for (const [id, address] of Object.entries(calendarSecrets)) app.secretStorage.setSecret(id, address);
	setCalendarResponses(calendarResponses);

	const plugin = new ProjectDashboardPlugin(app);
	await plugin.onload();
	if (new URLSearchParams(window.location.search).get('mode') === 'settings') {
		const tab = plugin.settingTabs.find((candidate) => candidate instanceof DashboardSettingTab);
		if (!tab) throw new Error('找不到展示設定頁');
		root.appendChild(tab.containerEl);
		tab.display();
		root.dataset.mode = 'settings';
	} else {
		const leaf = app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_DASHBOARD });
		// Wait for both built-in calendars before the capture script sees ready.
		await plugin.calendars.refresh();
		root.dataset.mode = 'dashboard';
		window.addEventListener('pagehide', () => {
			if (leaf.view instanceof ItemView) { void leaf.view.onClose(); leaf.view.unload(); }
			plugin.onunload();
			plugin.unload();
		}, { once: true });
	}
	await document.fonts.ready;
	root.dataset.ready = 'true';
}

void main().catch((error: unknown) => {
	const root = document.querySelector<HTMLElement>('#screenshot-root');
	if (root) { root.dataset.error = 'true'; root.setText(`展示頁無法載入：${String(error)}`); }
});
