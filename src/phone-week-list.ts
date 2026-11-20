import { overdueLines, phoneWeekGroups, phoneWeekLabels, scheduleToThisWeekDays, type PhoneProjectLines } from './core/phone-weeks';
import type { ProjectRecord } from './core/scan';
import { SHIFT_WEEK_DAYS, toggleDoneLine, type ScheduleRules, type TaskLine } from './core/task-lines';
import { addDaysISO, mondayOfWeek, monthDayLabel, weekOfTaskDate, weekRangeShort } from './core/weeks';

export interface PhoneWeekListHost {
	projects(): ProjectRecord[];
	settings(): ScheduleRules;
	today(): string;
	toggle(project: ProjectRecord, line: TaskLine): Promise<boolean>;
	shift(project: ProjectRecord, line: TaskLine, days: number): Promise<boolean>;
	openNote(path: string): void;
	showToast(message: string): void;
}

type RowControl = HTMLInputElement | HTMLButtonElement;
interface RetainedLine { path: string; line: number; raw: string }
interface PendingControl { control: RowControl; disabled: boolean }

// 展開狀態屬於這次分頁；重繪沿用元件，重新開啟分頁才建立新的元件。
export class PhoneWeekList {
	private expanded = false;
	private retained: RetainedLine[] = [];
	private readonly pending = new Map<string, PendingControl[]>();
	private readonly controlsByPath = new Map<string, RowControl[]>();

	constructor(private readonly host: PhoneWeekListHost) {}

	render(container: HTMLElement): void {
		container.empty();
		this.controlsByPath.clear();
		const projects = this.host.projects();
		if (projects.length === 0) {
			container.createDiv({ cls: 'empty', text: '（沒有符合條件的專案）' });
			return;
		}
		const weeks = phoneWeekLabels(this.host.today());
		const overdue = overdueLines(projects, this.host.settings(), this.host.today());
		const count = overdue.reduce((sum, group) => sum + group.lines.length, 0);
		if (count > 0 || this.expanded) {
			const section = container.createEl('section', { cls: 'phone-overdue' });
			const heading = section.createEl('button', {
				cls: 'phone-overdue-heading',
				text: `${this.expanded ? '▾' : '▸'} 之前還沒做（${count}）`,
				attr: { type: 'button', 'aria-expanded': String(this.expanded) },
			});
			heading.addEventListener('click', () => {
				this.expanded = !this.expanded;
				if (!this.expanded) this.retained = [];
				this.render(container);
			});
			if (this.expanded) {
				for (const group of this.overdueWithCompleted(projects, overdue)) this.renderGroup(section, group, true);
			}
		}
		for (const [index, { week, groups }] of phoneWeekGroups(projects, weeks, this.host.settings()).entries()) {
			const section = container.createEl('section', { cls: 'phone-week', attr: { 'data-week': week } });
			const label = index === 0 ? '本週 ' : index === 1 ? '下週 ' : '';
			section.createEl('h2', { cls: 'phone-week-heading', text: `${label}W${Number(week.slice(6))} ${weekRangeShort(week)}` });
			if (groups.length === 0) section.createDiv({ cls: 'phone-empty', text: '這週沒有任務' });
			for (const group of groups) this.renderGroup(section, group, false);
		}
	}

	private overdueWithCompleted(projects: ProjectRecord[], overdue: PhoneProjectLines[]): PhoneProjectLines[] {
		const discarded = new Set<RetainedLine>();
		const groups = projects.flatMap((project) => {
			const lines = [...(overdue.find((group) => group.project.path === project.path)?.lines ?? [])];
			for (const saved of this.retained.filter((entry) => entry.path === project.path)) {
				// 舊行號也可能已是另一行；原文不唯一就永久放棄這筆暫留紀錄。
				const matches = project.task_lines.filter((line) => line.raw === saved.raw);
				if (matches.length > 1) {
					discarded.add(saved);
					continue;
				}
				const line = matches[0];
				if (line?.done) {
					saved.line = line.line;
					if (!lines.includes(line)) lines.push(line);
				}
			}
			lines.sort((a, b) => a.due!.localeCompare(b.due!) || a.line - b.line);
			return lines.length ? [{ project, lines }] : [];
		});
		this.retained = this.retained.filter((entry) => !discarded.has(entry));
		return groups;
	}

	private renderGroup(container: HTMLElement, { project, lines }: PhoneProjectLines, overdue: boolean): void {
		const group = container.createDiv({ cls: 'phone-project' });
		group.setCssProps({ '--pd-cat-color': project.color });
		const name = group.createEl('button', { cls: 'phone-project-name', attr: { type: 'button', 'data-path': project.path } });
		name.createSpan({ cls: 'cat-dot', attr: { 'aria-hidden': 'true' } });
		name.createSpan({ text: project.name });
		name.addEventListener('click', () => this.host.openNote(project.path));
		for (const line of lines) this.renderRow(group, project, line, overdue);
	}

	private renderRow(container: HTMLElement, project: ProjectRecord, line: TaskLine, overdue: boolean): void {
		const row = container.createDiv({ cls: `phone-task ${line.done ? 'phone-done' : overdue ? 'phone-late' : 'phone-open'}` });
		const controls: RowControl[] = [];
		const hit = row.createEl('label', { cls: 'phone-check-hit' });
		const checkbox = hit.createEl('input', { cls: 'phone-check', attr: { type: 'checkbox', 'aria-label': line.text } });
		checkbox.checked = line.done;
		checkbox.disabled = !line.checkbox || line.recurring;
		if (line.recurring) checkbox.setAttribute('title', '重複任務請在筆記裡勾選');
		controls.push(checkbox);
		if (!checkbox.disabled) checkbox.addEventListener('change', () => {
			void this.runAction(project, controls, async () => {
				const saved = { path: project.path, line: line.line, raw: toggleDoneLine(line.raw, this.host.today()) };
				const previous = overdue ? this.retained.filter((entry) => entry.path === project.path
					&& entry.raw === line.raw && entry.line === line.line) : [];
				if (overdue && !line.done) this.retained.push(saved);
				const ok = await this.host.toggle(project, line);
				// 取消成功後才移除；失敗期間的重掃仍要讓已完成的行留著供重試。
				if (ok) this.retained = this.retained.filter((entry) => !previous.includes(entry));
				else {
					this.retained = this.retained.filter((entry) => entry !== saved);
					checkbox.checked = line.done;
				}
			});
		});
		const body = row.createDiv({ cls: 'phone-task-body' });
		body.createSpan({ cls: 'phone-task-text', text: line.text });
		if (line.due !== null) body.createSpan({ cls: 'phone-date', text: monthDayLabel(line.due) });
		if (line.checkbox && !line.done && line.due !== null) {
			const actions = row.createDiv({ cls: 'phone-actions' });
			const addButton = (text: string, title: string, days: number, notify: boolean): void => {
				const button = actions.createEl('button', { cls: 'phone-action', text, attr: { type: 'button', title } });
				controls.push(button);
				button.addEventListener('click', () => {
					void this.runAction(project, controls, async () => {
						if (await this.host.shift(project, line, days) && notify) this.notifyShift(line, days);
					});
				});
			};
			if (overdue) addButton('排到本週', '排到本週', scheduleToThisWeekDays(line, this.host.settings(), this.host.today()), false);
			else {
				addButton('◀', '移到上一週', -SHIFT_WEEK_DAYS, true);
				addButton('▶', '移到下一週', SHIFT_WEEK_DAYS, true);
			}
		}
		const projectControls = this.controlsByPath.get(project.path) ?? [];
		projectControls.push(...controls);
		this.controlsByPath.set(project.path, projectControls);
		const pending = this.pending.get(project.path);
		if (pending) this.disableControls(controls, pending);
	}

	private notifyShift(line: TaskLine, days: number): void {
		const date = addDaysISO(line.due!, days);
		const mapped = weekOfTaskDate(date, this.host.settings());
		const weeks = phoneWeekLabels(this.host.today());
		if (!mapped || weeks.includes(mapped.label)) return;
		const before = mondayOfWeek(mapped.label) < mondayOfWeek(weeks[0]!);
		this.host.showToast(`已移到 ${monthDayLabel(date)}，${before ? '在「之前還沒做」裡' : '超出這 4 週'}`);
	}

	private disableControls(controls: RowControl[], pending: PendingControl[]): void {
		for (const control of controls) {
			pending.push({ control, disabled: control.disabled });
			control.disabled = true;
		}
	}

	private async runAction(project: ProjectRecord, controls: RowControl[], action: () => Promise<void>): Promise<void> {
		// 同一則筆記的行號可能在等待寫入時改變，鎖定路徑才能跨重繪守住控制項。
		const key = project.path;
		if (this.pending.has(key)) return;
		const pending: PendingControl[] = [];
		this.pending.set(key, pending);
		this.disableControls(this.controlsByPath.get(key) ?? controls, pending);
		try {
			await action();
		} finally {
			this.pending.delete(key);
			for (const { control, disabled } of pending) control.disabled = disabled;
		}
	}
}
