import { SHIFT_WEEK_DAYS, type TaskLine } from './core/task-lines';
import { monthDayLabel, monthDayWeekdayLabel, taskDateToWeekLabel, weekRangeLabel } from './core/weeks';

// 重繪後要還原的底部區塊：「還沒排日期的任務」清單、新增任務輸入框，或都沒展開。
export type PopoverSection = 'unscheduled' | 'input' | null;

// 重繪前後搬運的浮窗狀態：展開哪一區、輸入框裡還沒送出的文字、輸入框原本是否
// 有焦點（dashboard-note-sync：只有原本有焦點才搶回焦點）。
export interface PopoverViewState {
	section: PopoverSection;
	inputText: string;
	inputFocused: boolean;
}

export const CLOSED_POPOVER_STATE: PopoverViewState = { section: null, inputText: '', inputFocused: false };

// 寫入的結果決定這一列要不要復原：`rerender` 代表畫面稍後會被整個重畫
// （成功後的 debounce 重繪，或 stale/invalid 之後的立即重掃），這段期間
// 維持停用與目標勾選狀態；`restore` 代表沒有重繪會來，要把控制項放回去。
export type WeekPopoverActionResult = 'rerender' | 'restore';

export interface WeekPopoverModel {
	projectName: string;
	weekLabel: string;
	// 該週落在 overflow 區間時，帶專案的預計結束日期（顯示在標題第三行）；否則 null。
	overflowEnd: string | null;
	rows: TaskLine[];
	unscheduled: TaskLine[];
}

// view.ts 提供的動作：浮窗只負責畫與停用，寫入、toast、重繪都留在 view。
export interface WeekPopoverHost {
	toggle(line: TaskLine): Promise<WeekPopoverActionResult>;
	shift(line: TaskLine, days: number): Promise<WeekPopoverActionResult>;
	schedule(line: TaskLine): Promise<WeekPopoverActionResult>;
	addTask(text: string): Promise<WeekPopoverActionResult>;
	jump(line: TaskLine): void;
	// 標題的專案名稱：在右側分割打開這則筆記，浮窗留著。
	openNote(): void;
	// 展開／收起底部區塊會改變高度，view 要重新算位置。
	onContentResize(): void;
}

type RowControl = HTMLInputElement | HTMLButtonElement;

export class WeekPopover {
	private expanded: PopoverSection = null;
	private model: WeekPopoverModel | null = null;
	private inputEl: HTMLInputElement | null = null;
	// 下一次畫輸入框時要還原的狀態；畫完就清掉，之後自己展開輸入框是空的。
	private pendingInput: { text: string; focused: boolean } | null = null;

	constructor(
		private readonly el: HTMLElement,
		private readonly host: WeekPopoverHost,
	) {}

	// 重繪前由 view 取走：送出中（輸入框被停用）代表那段文字已經寫進筆記，不要
	// 帶回來；而停用輸入框會讓它失去焦點，所以送出中也算原本有焦點。
	captureState(): PopoverViewState {
		const input = this.inputEl;
		if (!input || !input.isConnected) {
			return { section: this.expanded, inputText: '', inputFocused: false };
		}
		const inFlight = input.disabled;
		return {
			section: this.expanded,
			inputText: inFlight ? '' : input.value,
			inputFocused: inFlight || input.ownerDocument.activeElement === input,
		};
	}

	// timeline 模式維持唯讀：只顯示色條的 title 文字，沒有任何控制項。
	renderText(text: string): void {
		this.model = null;
		this.expanded = null;
		this.inputEl = null;
		this.pendingInput = null;
		this.el.empty();
		this.el.createDiv({ cls: 'wp-plain', text });
	}

	render(model: WeekPopoverModel, state: PopoverViewState): void {
		this.model = model;
		this.expanded = state.section;
		this.pendingInput = state.section === 'input' ? { text: state.inputText, focused: state.inputFocused } : null;
		this.draw();
	}

	private draw(): void {
		const model = this.model;
		if (!model) return;
		this.el.empty();
		this.inputEl = null;

		const header = this.el.createDiv({ cls: 'wp-header' });
		// 用 button 而不是 div：鍵盤可以 Tab 到並用 Enter／空白鍵打開筆記。
		const project = header.createEl('button', {
			cls: 'wp-project',
			text: model.projectName,
			attr: { type: 'button', title: '在右側開啟筆記' },
		});
		project.addEventListener('click', () => this.host.openNote());
		header.createDiv({ cls: 'wp-week', text: weekRangeLabel(model.weekLabel) });
		if (model.overflowEnd) {
			header.createDiv({ cls: 'wp-overflow', text: `⚠ 已超出預計結束日期 ${model.overflowEnd}` });
		}

		const list = this.el.createDiv({ cls: 'wp-list' });
		if (model.rows.length === 0) {
			list.createDiv({ cls: 'wp-empty', text: '這週還沒有任務' });
		} else {
			for (const line of model.rows) this.drawRow(list, line, model.weekLabel);
		}

		this.drawFooter(model);
	}

	private drawRow(list: HTMLElement, line: TaskLine, weekLabel: string): void {
		const row = list.createDiv({ cls: 'wp-row' });

		const checkbox = row.createEl('input', { cls: 'wp-check', attr: { type: 'checkbox' } });
		checkbox.checked = line.done;
		const togglable = line.checkbox && !line.recurring;
		checkbox.disabled = !togglable;
		if (line.recurring) checkbox.setAttribute('title', '重複任務請在筆記裡勾選');
		if (togglable) {
			checkbox.addEventListener('change', () => {
				void this.runRowAction(row, line, () => this.host.toggle(line));
			});
		}

		row.createSpan({ cls: 'wp-text', text: line.text });

		// 已完成的行顯示完成日；未完成顯示預計日。勾了 [x] 卻沒有 ✅ 的行沒有完成日，
		// 只寫「已完成」，不拿預計日冒充完成日。
		const shown = line.done ? line.doneDate : line.due;
		if (line.done && !shown) row.createSpan({ cls: 'wp-date', text: '已完成' });
		if (shown) {
			const label = line.done ? `已完成 ${monthDayLabel(shown)}` : monthDayWeekdayLabel(shown);
			row.createSpan({ cls: 'wp-date', text: label });
			const mapped = taskDateToWeekLabel(shown);
			if (mapped.isBumpedSat && mapped.label === weekLabel) {
				// 已完成的行顯示的是完成日，不是預排日，所以兩種說法分開。
				row.createSpan({ cls: 'wp-sat', text: line.done ? '上週六完成，算進本週' : '預排在上週六，算進本週' });
			}
		}

		const actions = row.createDiv({ cls: 'wp-actions' });
		if (line.checkbox && !line.done && line.due !== null) {
			const prev = actions.createEl('button', {
				cls: 'wp-btn',
				text: '◀',
				attr: { type: 'button', title: '移到上一週' },
			});
			prev.addEventListener('click', () => {
				void this.runRowAction(row, line, () => this.host.shift(line, -SHIFT_WEEK_DAYS));
			});
			const next = actions.createEl('button', {
				cls: 'wp-btn',
				text: '▶',
				attr: { type: 'button', title: '移到下一週' },
			});
			next.addEventListener('click', () => {
				void this.runRowAction(row, line, () => this.host.shift(line, SHIFT_WEEK_DAYS));
			});
		}
		const jump = actions.createEl('button', {
			cls: 'wp-btn',
			text: '↗',
			attr: { type: 'button', title: '在筆記裡顯示這一行' },
		});
		jump.addEventListener('click', () => this.host.jump(line));
	}

	private drawFooter(model: WeekPopoverModel): void {
		const footer = this.el.createDiv({ cls: 'wp-footer' });

		const pick = footer.createEl('button', {
			cls: 'wp-entry',
			text: `＋ 從還沒排日期的任務挑一個（${model.unscheduled.length}）`,
			attr: { type: 'button' },
		});
		pick.addEventListener('click', () => {
			this.setExpanded(this.expanded === 'unscheduled' ? null : 'unscheduled');
		});

		if (this.expanded === 'unscheduled') {
			const picker = footer.createDiv({ cls: 'wp-unscheduled' });
			if (model.unscheduled.length === 0) {
				picker.createDiv({ cls: 'wp-empty', text: '這則筆記沒有還沒排日期的任務' });
			} else {
				for (const line of model.unscheduled) {
					const item = picker.createEl('button', {
						cls: 'wp-pick',
						text: line.text,
						attr: { type: 'button' },
					});
					item.addEventListener('click', () => {
						item.disabled = true;
						void this.host.schedule(line).then((result) => {
							if (result === 'restore' && item.isConnected) item.disabled = false;
						});
					});
				}
			}
		}

		const add = footer.createEl('button', { cls: 'wp-entry', text: '＋ 新增任務', attr: { type: 'button' } });
		add.addEventListener('click', () => {
			this.setExpanded(this.expanded === 'input' ? null : 'input');
		});

		if (this.expanded === 'input') this.drawInput(footer);
	}

	private drawInput(footer: HTMLElement): void {
		const input = footer.createEl('input', {
			cls: 'wp-input',
			attr: { type: 'text', placeholder: '輸入任務，Enter 加入，Esc 取消' },
		});
		this.inputEl = input;
		const restore = this.pendingInput;
		this.pendingInput = null;
		input.addEventListener('keydown', (e: KeyboardEvent) => {
			// 注音等輸入法選字時按 Enter／Esc 是在確認或取消組字，不能當成送出或關閉，
			// 否則會把打到一半的字寫進筆記。
			if (e.isComposing) return;
			if (e.key === 'Escape') {
				// Esc 在輸入框裡只關掉輸入框：不能傳到 view 的 Scope handler，
				// 那一層會把整個浮窗關掉。
				e.preventDefault();
				e.stopPropagation();
				this.setExpanded(null);
				return;
			}
			if (e.key !== 'Enter') return;
			e.preventDefault();
			const text = input.value;
			if (text.trim() === '') return; // 空白輸入不寫入，也不呼叫寫入模組
			input.disabled = true;
			void this.host.addTask(text).then((result) => {
				if (result !== 'restore' || !input.isConnected) return;
				input.disabled = false;
				input.focus();
			});
		});
		if (restore) {
			input.value = restore.text;
			// 重繪只在原本有焦點時搶回焦點：在筆記裡打字觸發的重繪不能把游標搬走。
			if (restore.focused) input.focus();
			return;
		}
		input.focus();
	}

	private setExpanded(next: PopoverSection): void {
		this.expanded = next;
		this.draw();
		this.host.onContentResize();
	}

	// 寫入中整列先停用、勾選框先顯示按下去的狀態（design.md：等重繪帶回結果）。
	private async runRowAction(
		row: HTMLElement,
		line: TaskLine,
		action: () => Promise<WeekPopoverActionResult>,
	): Promise<void> {
		const controls = Array.from(row.querySelectorAll<RowControl>('input, button'));
		const wasDisabled = controls.map((c) => c.disabled);
		for (const control of controls) control.disabled = true;
		row.classList.add('wp-pending');

		const result = await action();
		if (result !== 'restore' || !row.isConnected) return;

		controls.forEach((control, i) => {
			control.disabled = wasDisabled[i]!;
		});
		// 用選擇器而不是 instanceof：浮窗可能畫在 Obsidian 的獨立視窗裡，那裡的
		// HTMLInputElement 跟主視窗的不是同一個建構函式，instanceof 永遠是 false。
		const checkbox = row.querySelector<HTMLInputElement>('input.wp-check');
		if (checkbox) checkbox.checked = line.done;
		row.classList.remove('wp-pending');
	}
}
