import { PluginSettingTab, Setting, TFolder, type App } from 'obsidian';
import { CATEGORIES, CATEGORY_KEYS } from './core/config';
import {
	addClassificationRule,
	moveClassificationRule,
	removeClassificationRule,
	replaceClassificationRule,
	weekdayFromOption,
	type DashboardSettings,
} from './core/settings';
import type ProjectDashboardPlugin from './main';

// 下拉選單的選項：值是 `"1"` 到 `"7"`，送進設定前由 weekdayFromOption 轉成整數。
const WEEKDAY_LABELS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export class DashboardSettingTab extends PluginSettingTab {
	private unsubscribe: (() => void) | null = null;

	constructor(app: App, private readonly plugin: ProjectDashboardPlugin) {
		super(app, plugin);
	}

	private get settings(): DashboardSettings {
		return this.plugin.store.data.settings;
	}

	display(): void {
		// 重畫也會重新訂閱，所以先取消上一次的訂閱，不然會疊起來。
		this.unsubscribe?.();
		this.unsubscribe = this.plugin.store.subscribe((reason) => {
			// 存檔失敗要顯示還原後的值，外部變更要顯示同步過來的值；存檔成功時畫面
			// 上的值已經是對的，重畫只會把游標從正在打字的欄位踢走。
			if (reason === 'settings-reverted' || reason === 'reloaded') this.display();
		});

		this.containerEl.empty();
		this.buildProjectNotesSection();
		this.buildClassificationSection();
		this.buildDateRulesSection();
	}

	hide(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
	}

	// 每個修改都交給外掛資料元件：它負責檢查、合併存檔與通知儀表板。
	private patch(partial: Partial<DashboardSettings>): void {
		this.plugin.store.updateSettings({ ...this.settings, ...partial });
	}

	// 改動規則清單的長度或順序以後整頁重畫，設定頁的每一列才會重新對上存起來的
	// 那一條規則（首列上移與末列下移的停用狀態也跟著更新）。
	private patchRules(rules: DashboardSettings['classificationRules']): void {
		this.patch({ classificationRules: rules });
		this.display();
	}

	private buildProjectNotesSection(): void {
		new Setting(this.containerEl).setName('專案筆記').setHeading();

		const folderSetting = new Setting(this.containerEl)
			.setName('專案資料夾')
			.setDesc('vault 裡放專案筆記的資料夾，只讀這一層，不含子資料夾。');
		folderSetting.settingEl.addClass('pd-setting-folder');
		// 提示在輸入框之後建立，才會換行顯示在欄位下方。
		let hintEl: HTMLElement;
		folderSetting.addText((text) => {
			text.setValue(this.settings.projectFolder).onChange((value) => {
				this.patch({ projectFolder: value });
				this.updateFolderHint(hintEl);
			});
		});
		hintEl = folderSetting.controlEl.createDiv({ cls: 'pd-setting-hint', text: '找不到這個資料夾' });
		this.updateFolderHint(hintEl);

		new Setting(this.containerEl)
			.setName('不列入的專案')
			.setDesc('檔名包含這些文字的筆記不會出現在儀表板，一行一個。')
			.addTextArea((text) => {
				text.setValue(this.settings.excludedProjects.join('\n')).onChange((value) => {
					// 檢查規則會把空白行去掉，所以這裡照原樣送進去就好。
					this.patch({ excludedProjects: value.split('\n') });
				});
			});
	}

	// 提示用「檢查過的資料夾」判斷：欄位清空時掃描與存檔都用 `Projects`，
	// 提示也要跟著用它判斷，不能用輸入框裡的空字串。
	private updateFolderHint(hintEl: HTMLElement): void {
		const folder = this.settings.projectFolder;
		hintEl.hidden = this.app.vault.getAbstractFileByPath(folder) instanceof TFolder;
	}

	private buildClassificationSection(): void {
		new Setting(this.containerEl)
			.setName('分類')
			.setDesc('專案名稱包含左邊的文字，就歸到右邊的分類。由上往下比對，第一個符合的規則生效；在儀表板上手動指定的分類優先於這些規則。')
			.setHeading();

		const rules = this.settings.classificationRules;
		rules.forEach((rule, index) => {
			const row = new Setting(this.containerEl);
			row.settingEl.addClass('pd-rule-row');
			row.addText((text) => {
				text.setPlaceholder('名稱包含…')
					.setValue(rule.text)
					.onChange((value) => {
						this.patch({ classificationRules: replaceClassificationRule(this.settings.classificationRules, index, { text: value }) });
					});
			});
			row.addDropdown((dropdown) => {
				for (const key of CATEGORY_KEYS) dropdown.addOption(key, CATEGORIES[key]!.label);
				dropdown.setValue(rule.category).onChange((value) => {
					this.patch({ classificationRules: replaceClassificationRule(this.settings.classificationRules, index, { category: value }) });
				});
			});
			row.addExtraButton((button) => {
				button.setIcon('arrow-up')
					.setTooltip('上移')
					.setDisabled(index === 0)
					.onClick(() => {
						this.patchRules(moveClassificationRule(this.settings.classificationRules, index, -1));
					});
			});
			row.addExtraButton((button) => {
				button.setIcon('arrow-down')
					.setTooltip('下移')
					.setDisabled(index === rules.length - 1)
					.onClick(() => {
						this.patchRules(moveClassificationRule(this.settings.classificationRules, index, 1));
					});
			});
			row.addExtraButton((button) => {
				button.setIcon('trash')
					.setTooltip('刪除')
					.onClick(() => {
						this.patchRules(removeClassificationRule(this.settings.classificationRules, index));
					});
			});
		});

		new Setting(this.containerEl).addButton((button) => {
			button.setButtonText('新增分類規則').onClick(() => {
				this.patchRules(addClassificationRule(this.settings.classificationRules));
			});
		});
	}

	private buildDateRulesSection(): void {
		new Setting(this.containerEl).setName('日期規則').setHeading();

		new Setting(this.containerEl)
			.setName('排進某週時寫星期幾')
			.setDesc('從浮窗把任務排進某一週或新增任務時，寫入那週的這一天。')
			.addDropdown((dropdown) => {
				WEEKDAY_LABELS.forEach((label, i) => {
					dropdown.addOption(String(i + 1), label);
				});
				dropdown.setValue(String(this.settings.scheduleWeekday)).onChange((value) => {
					this.patch({ scheduleWeekday: weekdayFromOption(value) });
				});
			});

		new Setting(this.containerEl)
			.setName('週六的任務算到下一週')
			.setDesc('開啟後，日期寫週六的任務會顯示在下一週，代表「週六先排好下週要做的事」。')
			.addToggle((toggle) => {
				toggle.setValue(this.settings.saturdayCountsAsNextWeek).onChange((value) => {
					this.patch({ saturdayCountsAsNextWeek: value });
				});
			});
	}
}
