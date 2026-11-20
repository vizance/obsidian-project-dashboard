import { PluginSettingTab, Setting, TFolder, setTooltip, type App } from 'obsidian';
import { isCalendarAddress } from './core/calendar';
import { CATEGORIES, CATEGORY_KEYS } from './core/config';
import {
	addCalendar,
	addClassificationRule,
	CALENDAR_SECRET_PREFIX,
	calendarColor,
	calendarLinkPlaceholder,
	generateCalendarSecretId,
	moveClassificationRule,
	removeCalendar,
	removeClassificationRule,
	replaceCalendar,
	replaceClassificationRule,
	weekdayFromOption,
	type DashboardSettings,
} from './core/settings';
import type ProjectDashboardPlugin from './main';

// 下拉選單的選項：值是 `"1"` 到 `"7"`，送進設定前由 weekdayFromOption 轉成整數。
// 設定頁屬於外掛層級，文字用淺白英文；儀表板本身維持繁體中文。
const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
		this.buildCalendarSection();
	}

	hide(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
	}

	// 每個修改都交給外掛資料元件：它負責檢查、合併存檔與通知儀表板。
	private patch(partial: Partial<DashboardSettings>): void {
		this.plugin.store.updateSettings({ ...this.settings, ...partial });
	}

	// 改動清單的長度或順序以後整頁重畫，設定頁的每一列才會重新對上存起來的那一條規則
	// 或那一個行事曆（首列上移與末列下移的停用狀態也跟著更新）。
	private patchAndRedraw(partial: Partial<DashboardSettings>): void {
		this.patch(partial);
		this.display();
	}

	private patchRules(rules: DashboardSettings['classificationRules']): void {
		this.patchAndRedraw({ classificationRules: rules });
	}

	private patchCalendars(calendars: DashboardSettings['calendars']): void {
		this.patchAndRedraw({ calendars });
	}

	private buildProjectNotesSection(): void {
		new Setting(this.containerEl).setName('Project notes').setHeading();

		const folderSetting = new Setting(this.containerEl)
			.setName('Project folder')
			.setDesc('The folder where your project notes live. Only notes right inside this folder are used. Notes in folders inside it are skipped.');
		folderSetting.settingEl.addClass('pd-setting-folder');
		// 提示在輸入框之後建立，才會換行顯示在欄位下方。
		let hintEl: HTMLElement;
		folderSetting.addText((text) => {
			text.setValue(this.settings.projectFolder).onChange((value) => {
				this.patch({ projectFolder: value });
				this.updateFolderHint(hintEl);
			});
		});
		hintEl = folderSetting.controlEl.createDiv({ cls: 'pd-setting-hint', text: `Can't find this folder.` });
		this.updateFolderHint(hintEl);

		new Setting(this.containerEl)
			.setName('Projects to skip')
			.setDesc('Write one word or phrase on each line. A note whose name has any of them will not show on the dashboard.')
			.addTextArea((text) => {
				text.setValue(this.settings.excludedProjects.join('\n')).onChange((value) => {
					// 檢查規則會把空白行去掉，所以這裡照原樣送進去就好。
					this.patch({ excludedProjects: value.split('\n') });
				});
			});
	}

	// `Can't find this folder.` 用「檢查過的資料夾」判斷：欄位清空時掃描與存檔都用 `Projects`，
	// 提示也要跟著用它判斷，不能用輸入框裡的空字串。
	private updateFolderHint(hintEl: HTMLElement): void {
		const folder = this.settings.projectFolder;
		hintEl.hidden = this.app.vault.getAbstractFileByPath(folder) instanceof TFolder;
	}

	private buildClassificationSection(): void {
		new Setting(this.containerEl)
			.setName('Categories')
			.setDesc(`If a project's name has the words on the left, it goes into the category on the right. The rules are checked from top to bottom, and the first one that matches wins. A category you pick by hand on the dashboard always beats these rules.`)
			.setHeading();

		const rules = this.settings.classificationRules;
		rules.forEach((rule, index) => {
			const row = new Setting(this.containerEl);
			row.settingEl.addClass('pd-rule-row');
			row.addText((text) => {
				text.setPlaceholder('Words in the name…')
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
					.setTooltip('Move up')
					.setDisabled(index === 0)
					.onClick(() => {
						this.patchRules(moveClassificationRule(this.settings.classificationRules, index, -1));
					});
			});
			row.addExtraButton((button) => {
				button.setIcon('arrow-down')
					.setTooltip('Move down')
					.setDisabled(index === rules.length - 1)
					.onClick(() => {
						this.patchRules(moveClassificationRule(this.settings.classificationRules, index, 1));
					});
			});
			row.addExtraButton((button) => {
				button.setIcon('trash')
					.setTooltip('Delete')
					.onClick(() => {
						this.patchRules(removeClassificationRule(this.settings.classificationRules, index));
					});
			});
		});

		new Setting(this.containerEl).addButton((button) => {
			button.setButtonText('Add a rule').onClick(() => {
				this.patchRules(addClassificationRule(this.settings.classificationRules));
			});
		});
	}

	private buildDateRulesSection(): void {
		new Setting(this.containerEl).setName('Dates').setHeading();

		new Setting(this.containerEl)
			.setName('Which day to write')
			.setDesc(`When you add a task to a week from the week pop-up, the note gets this day of that week as the task's date.`)
			.addDropdown((dropdown) => {
				WEEKDAY_LABELS.forEach((label, i) => {
					dropdown.addOption(String(i + 1), label);
				});
				dropdown.setValue(String(this.settings.scheduleWeekday)).onChange((value) => {
					this.patch({ scheduleWeekday: weekdayFromOption(value) });
				});
			});

		new Setting(this.containerEl)
			.setName('Saturday tasks count for next week')
			.setDesc('Turn this on if you plan next week on Saturday. Then a task with a Saturday date shows up in the week after.')
			.addToggle((toggle) => {
				toggle.setValue(this.settings.saturdayCountsAsNextWeek).onChange((value) => {
					this.patch({ saturdayCountsAsNextWeek: value });
				});
			});
	}

	private buildCalendarSection(): void {
		const heading = new Setting(this.containerEl)
			.setName('Calendars')
			.setDesc('Show events from your calendars at the top of the month view. The plugin only reads your calendars. It never changes them.')
			.setHeading();
		// 取得方式另起一行：使用者要照著這一步去 Google 複製連結，和上面的說明分開才好找。
		heading.descEl.createDiv({ text: 'Google Calendar: open the calendar\'s settings and copy "Secret address in iCal format" (iCal 格式的私密網址).' });
		heading.descEl.createDiv({ text: 'iCloud: share the calendar as a public calendar and copy its link.' });

		this.settings.calendars.forEach((calendar, index) => {
			const row = new Setting(this.containerEl);
			row.settingEl.addClass('pd-calendar-row');
			row.addText((text) => {
				text.setPlaceholder('Calendar name')
					.setValue(calendar.name)
					.onChange((value) => {
						this.patch({ calendars: replaceCalendar(this.settings.calendars, index, { name: value }) });
					});
			});
			row.addText((text) => {
				const storedValue = calendar.secretId === '' ? null : this.app.secretStorage.getSecret(calendar.secretId);
				text.setPlaceholder(calendarLinkPlaceholder(calendar.secretId, storedValue));
				text.inputEl.type = 'password';
				text.inputEl.spellcheck = false;
				text.inputEl.autocomplete = 'off';
				const errorEl = row.controlEl.createDiv({
					cls: 'pd-calendar-error',
					text: 'This is not a calendar link. It should start with https:// or webcal://.',
				});
				errorEl.setAttribute('role', 'alert');
				errorEl.hidden = true;
				text.onChange(() => { errorEl.hidden = true; });
				const saveLink = (): void => {
					// 貼上事件延後執行時，這列可能已被刪除或重畫，不能把舊列寫回清單。
					if (!this.containerEl.contains(row.settingEl)) return;
					const link = text.getValue().trim();
					if (link === '') return;
					if (!isCalendarAddress(link)) {
						text.setValue('');
						errorEl.hidden = false;
						return;
					}
					const current = this.settings.calendars[index]!;
					const reuseId = current.secretId.startsWith(CALENDAR_SECRET_PREFIX);
					const id = reuseId ? current.secretId : generateCalendarSecretId([
						...this.settings.calendars.map((entry) => entry.secretId),
						...this.app.secretStorage.listSecrets(),
					]);
					this.app.secretStorage.setSecret(id, link);
					this.patch({ calendars: replaceCalendar(this.settings.calendars, index, { secretId: id }) });
					// 沿用 ID 時清單不會改變；新 ID 則由設定存檔觸發讀取，避免重複。
					if (reuseId) void this.plugin.calendars.refresh();
					// 只更新這個欄位，其他列尚未送出的連結與正在輸入的名稱才不會被清掉。
					text.setValue('').setPlaceholder(calendarLinkPlaceholder(id, link));
					errorEl.hidden = true;
				};
				text.inputEl.addEventListener('paste', () => {
					// paste 先於瀏覽器填入文字；等預設動作完成，才讀取貼上後的完整內容。
					window.setTimeout(saveLink, 0);
				});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' && !event.isComposing) {
						event.preventDefault();
						saveLink();
					}
				});
				text.inputEl.addEventListener('change', saveLink);
			});
			row.addColorPicker((picker) => {
				picker.setValue(calendarColor(calendar, index + 1)).onChange((color) => {
					this.patch({ calendars: replaceCalendar(this.settings.calendars, index, { color }) });
				});
			});
			const colorInput = row.controlEl.querySelector<HTMLInputElement>('input[type="color"]');
			if (colorInput) {
				setTooltip(colorInput, 'Color');
				colorInput.setAttribute('aria-label', 'Color');
			}
			row.addExtraButton((button) => {
				button.setIcon('trash')
					.setTooltip('Delete')
					.onClick(() => {
						const id = this.settings.calendars[index]!.secretId;
						if (id.startsWith(CALENDAR_SECRET_PREFIX)) this.app.secretStorage.setSecret(id, '');
						this.patchCalendars(removeCalendar(this.settings.calendars, index));
					});
			});
		});

		new Setting(this.containerEl).addButton((button) => {
			button.setButtonText('Add a calendar').onClick(() => {
				this.patchCalendars(addCalendar(this.settings.calendars));
			});
		});
	}
}
