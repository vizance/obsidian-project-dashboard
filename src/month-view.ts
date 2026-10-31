import type { Cell } from './core/cells';
import { monthViewCells } from './core/cells';
import { monthCellTaskLines, unscheduledSummary } from './core/months';
import type { ProjectRecord } from './core/scan';
import { todayWeekIndex, weekRangeShort, type WeekInfo, type WeekRules } from './core/weeks';
import { projectStateClass, renderProjectColHeader, renderProjectHeadCell } from './project-column';

// 「還沒排」格子的提示：任務本身在點開的浮窗裡列出來，所以這裡只說明點了會發生什麼。
const UNSCHEDULED_TOOLTIP = '點一下，把任務排進這個月的某一週';

// view.ts 提供的資料。每次畫都重新問，設定或今天的日期在分頁開著的時候被改掉時，
// 下一次重繪就跟著對（和週浮窗的 weekRules() 同一個做法）。
export interface MonthViewHost {
	// 要畫的專案列：篩選、排序、分組都由 view 用與年視圖相同的路徑算好。
	projects(): ProjectRecord[];
	// 顯示中的月份有哪幾週（weeksOfMonth 的結果），可以是任何一年的月份。
	weeks(): WeekInfo[];
	settings(): WeekRules;
	today(): string;
	categoryOrder(): string[];
}

// 月視圖和週浮窗一樣是獨立元件：只負責把表格畫進容器，從不改筆記，也不自己
// 處理點擊 — 格子帶著 data-path／data-week／data-kind，由 view.ts 的委派事件開浮窗。
export class MonthView {
	constructor(private readonly host: MonthViewHost) {}

	render(container: HTMLElement): void {
		const weeks = this.host.weeks();
		const projects = this.host.projects();
		const settings = this.host.settings();
		const today = this.host.today();
		// 今天這週用 ISO 週（一到日），和年視圖標示的今天欄相同；不在顯示的月份裡
		// 時 todayWeekIndex 回 -1，於是沒有任何一欄被標示。
		const todayIdx = todayWeekIndex(weeks, today);

		const table = container.createEl('table', { cls: 'gantt month-grid' });
		const thead = table.createEl('thead');
		const headRow = thead.createEl('tr');
		renderProjectColHeader(headRow, 1);
		for (const w of weeks) {
			const th = headRow.createEl('th', { cls: 'month-week' });
			th.createDiv({ cls: 'mw-week', text: `W${w.week}` });
			th.createDiv({ cls: 'mw-range', text: weekRangeShort(w.label) });
		}
		headRow.createEl('th', { cls: 'month-unscheduled', text: '還沒排' });

		const tbody = table.createEl('tbody');
		if (projects.length === 0) {
			const tr = tbody.createEl('tr');
			tr.createEl('td', { cls: 'proj-cell', text: '（沒有符合條件的專案）' });
			tr.createEl('td', { attr: { colspan: weeks.length + 1 } });
			return;
		}

		for (const project of projects) {
			const tr = tbody.createEl('tr');
			renderProjectHeadCell(tr, project, this.host.categoryOrder());

			const stateCls = projectStateClass(project);
			const cells = monthViewCells(project, weeks, settings);
			weeks.forEach((w, i) => {
				this.renderCell(tr, cells[i]!, project, stateCls, w.label, i === todayIdx, settings, today);
			});

			const summary = unscheduledSummary(project);
			const unscheduled = tr.createEl('td', {
				cls: 'month-unscheduled',
				text: summary.count > 0 ? String(summary.count) : '',
			});
			// 數量為 0 的格子既沒有提示也沒有 data-path，所以滑過去沒有提示框、
			// 點了也打不開浮窗（和 blank 的週格同一個做法）。
			if (summary.count > 0) {
				unscheduled.dataset.path = project.path;
				unscheduled.setAttribute('title', UNSCHEDULED_TOOLTIP);
			}
		}
	}

	private renderCell(
		tr: HTMLTableRowElement,
		cell: Cell,
		project: ProjectRecord,
		stateCls: string,
		weekLabel: string,
		isToday: boolean,
		settings: WeekRules,
		today: string,
	): void {
		const classes = ['month-cell', `mk-${cell.kind}`];
		if (isToday) classes.push('today-col');
		if (stateCls) classes.push(stateCls);
		const td = tr.createEl('td', { cls: classes.join(' ') });
		td.setCssProps({ '--pd-cat-color': project.color });

		if (cell.kind === 'blank') return;

		// 非空白的格子才帶這三個屬性，空白格因此既沒有文字也打不開浮窗。
		// `data-kind` 之所以留著：overflow 的格子要讓浮窗標題顯示專案的預計結束
		// 日期，和年視圖用 `bar-overflow` 判斷是同一件事。
		td.dataset.path = project.path;
		td.dataset.week = weekLabel;
		td.dataset.kind = cell.kind;

		for (const line of monthCellTaskLines(project, weekLabel, cell.kind, settings, today)) {
			td.createDiv({
				cls: `mc-line mc-${line.state}`,
				text: line.state === 'done' ? `✓ ${line.text}` : line.text,
			});
		}
	}
}
