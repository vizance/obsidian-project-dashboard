import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import { ProjectDashboardView } from '../src/view';
import type ProjectDashboardPlugin from '../src/main';
import type { VaultSource } from '../src/vault-source';
import { SettingsElement } from './stubs/obsidian';

function find(element: SettingsElement, matches: (element: SettingsElement) => boolean): SettingsElement[] {
	return [...(matches(element) ? [element] : []), ...element.children.flatMap((child) => find(child, matches))];
}

function withClass(element: SettingsElement, cls: string): SettingsElement[] {
	return find(element, (child) => child.classes.has(cls));
}

function textOf(element: SettingsElement): string {
	return element.textContent + element.children.map(textOf).join('');
}

function setup(scale: 'year' | 'month' = 'year') {
	// 沒有任何專案或設定資料，說明仍須完整可用。
	const view = new ProjectDashboardView({} as WorkspaceLeaf, {} as VaultSource, {} as ProjectDashboardPlugin);
	const fixture = view as unknown as {
		contentEl: SettingsElement;
		helpPanelEl: SettingsElement;
		helpFabEl: SettingsElement;
		helpPanelOpen: boolean;
		scale: 'year' | 'month';
		registerDomEvent: ReturnType<typeof vi.fn>;
		writeLocalStorage: ReturnType<typeof vi.fn>;
		scope: { register: ReturnType<typeof vi.fn> };
		buildHelpPanel(): void;
		setHelpPanelVisible(visible: boolean): void;
		toggleHelpPanel(visible?: boolean): void;
		registerShortcuts(): void;
	};
	fixture.contentEl = new SettingsElement();
	fixture.helpFabEl = new SettingsElement();
	fixture.scale = scale;
	fixture.writeLocalStorage = vi.fn();
	fixture.scope = { register: vi.fn() };
	fixture.registerDomEvent = vi.fn((element: SettingsElement, name: string, callback: EventListener) => {
		element.addEventListener(name, callback);
	});
	fixture.buildHelpPanel();
	fixture.registerShortcuts();
	const panel = fixture.helpPanelEl;
	// 補上本測試會用到的 DOM 查詢與焦點；共用 stub 保持不動。
	for (const element of find(panel, () => true)) {
		Object.assign(element, {
			getAttribute: (name: string) => element.attributes.get(name) ?? null,
			querySelectorAll: (selector: string) => find(element, (child) => selector === `[role="${child.attributes.get('role')}"]`),
			focus: vi.fn(),
		});
	}
	const tabs = find(panel, (el) => el.attributes.get('role') === 'tab');
	const panels = find(panel, (el) => el.attributes.get('role') === 'tabpanel');
	return { fixture, panel, tabs, panels };
}

function expectSelected(context: ReturnType<typeof setup>, index: number) {
	expect(context.tabs.map((el) => el.attributes.get('aria-selected'))).toEqual(
		context.tabs.map((_, i) => String(i === index)),
	);
	expect(context.tabs.map((el) => el.attributes.get('tabindex'))).toEqual(
		context.tabs.map((_, i) => i === index ? '0' : '-1'),
	);
	expect(context.panels.map((el) => el.hidden)).toEqual(context.panels.map((_, i) => i !== index));
}

function keydown(element: SettingsElement, key: string): Event {
	const event = new Event('keydown', { cancelable: true });
	Object.defineProperty(event, 'key', { value: key });
	element.dispatchEvent(event);
	return event;
}

describe('static help panel', () => {
	it('builds three accessible tabs without loaded project data', () => {
		const { panel, tabs, panels } = setup();
		expect(panel.attributes.get('id')).toBe('help-panel');
		expect(find(panel, (el) => el.attributes.get('role') === 'tablist')).toHaveLength(1);
		expect(tabs.map(textOf)).toEqual(['年視圖', '月視圖', '操作']);
		expect(panels).toHaveLength(3);
		for (const [index, tab] of tabs.entries()) {
			expect(tab.attributes.get('aria-controls')).toBe(panels[index]!.attributes.get('id'));
			expect(panels[index]!.attributes.get('aria-labelledby')).toBe(tab.attributes.get('id'));
		}
		expect(find(panel, (el) => el.tagName === 'button')).toHaveLength(4);
	});

	it.each(['year', 'month'] as const)('opens automatically on the current %s view', (scale) => {
		const context = setup(scale);
		expectSelected(context, scale === 'month' ? 1 : 0);
		context.fixture.setHelpPanelVisible(true);
		expectSelected(context, scale === 'month' ? 1 : 0);
		expect(context.panel.hidden).toBe(false);
		expect(context.fixture.helpFabEl.hidden).toBe(true);
	});

	it('opens with ? on the month tab and hides the other content', () => {
		const context = setup('month');
		context.fixture.setHelpPanelVisible(false);
		const shortcut = context.fixture.scope.register.mock.calls.find((call) => call[1] === '?')!;
		const toggleHelp = shortcut[2] as (event: { target: null }) => boolean;
		const handled = toggleHelp({ target: null });
		expect(handled).toBe(false);
		expect(context.panel.hidden).toBe(false);
		expectSelected(context, 1);
	});

	it('resets to the current view when reopened through the floating-button action', () => {
		const context = setup();
		context.fixture.toggleHelpPanel(true);
		context.tabs[2]!.dispatchEvent(new Event('click'));
		context.fixture.toggleHelpPanel(false);
		expect(context.panel.hidden).toBe(true);
		expect(context.fixture.helpFabEl.hidden).toBe(false);
		context.fixture.scale = 'month';
		context.fixture.toggleHelpPanel(true);
		expectSelected(context, 1);
		context.fixture.toggleHelpPanel(false);
		context.fixture.scale = 'year';
		context.fixture.toggleHelpPanel();
		expectSelected(context, 0);
	});

	it('switches from year to actions on click', () => {
		const context = setup();
		context.fixture.setHelpPanelVisible(true);
		context.tabs[2]!.dispatchEvent(new Event('click'));
		expectSelected(context, 2);
		expect(textOf(context.panels[2]!)).toContain('編輯分類與狀態');
		expect(textOf(context.panels[2]!)).toContain('M');
	});

	it('moves selection and focus with left/right arrows, including wrapping', () => {
		const context = setup();
		for (const [from, key, to] of [
			[0, 'ArrowRight', 1], [1, 'ArrowRight', 2], [2, 'ArrowRight', 0],
			[0, 'ArrowLeft', 2], [2, 'ArrowLeft', 1], [1, 'ArrowLeft', 0],
		] as const) {
			const event = keydown(context.tabs[from]!, key);
			expect(event.defaultPrevented).toBe(true);
			expectSelected(context, to);
			expect((context.tabs[to] as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled();
		}
		expect(keydown(context.tabs[0]!, 'Tab').defaultPrevented).toBe(false);
		expectSelected(context, 0);
	});

	it('shows all year groups and their exact explanations', () => {
		const context = setup();
		context.fixture.setHelpPanelVisible(true);
		const panel = context.panels[0]!;
		expect(find(panel, (el) => el.tagName === 'h4').map(textOf)).toEqual([
			'每一格＝這週的任務', '需要注意', '整列＝專案狀態', '顏色與欄位',
		]);
		expect(withClass(panel, 'help-description').map(textOf)).toEqual([
			'有任務，還沒全部完成',
			'這週的任務都完成了',
			'在專案期間內，這週沒有任務',
			'沒有任務，也不在專案期間（或專案已結案）',
			'超出預計結束日期還有任務；可以更新 frontmatter 的 預計結束日期',
			'日期有缺漏、是推算的，或有問題；滑過去看原因',
			'暫停的專案（勾「顯示暫停」才會出現）',
			'已完成或取消的專案（勾「顯示已結案」才會出現）',
			'專案的分類，對照上方圖例',
			'今天所在的週',
		]);
		expect(textOf(panel)).toContain('⏳ 暫停');
	});

	it('shows all month groups and their exact explanations', () => {
		const context = setup('month');
		context.fixture.setHelpPanelVisible(true);
		const panel = context.panels[1]!;
		expect(find(panel, (el) => el.tagName === 'h4').map(textOf)).toEqual([
			'格子裡的任務文字', '格子底色', 'General 列（行事曆）', '還沒排',
		]);
		expect(withClass(panel, 'help-description').map(textOf)).toEqual([
			'已完成的任務',
			'週已過還沒完成的任務',
			'還沒完成、週還沒過的任務',
			'行事曆名稱；顏色在設定頁改',
			'重新讀取行事曆；行程只能看，不能改',
			'還沒排日期的任務；點一下排進這個月的某一週',
		]);
		expect(textOf(panel)).toContain('底色的意思和年視圖一樣（實心、淡色、虛線、紅色、斜線紋）');
	});

	it('lists all actions under three groups without interactive sample controls', () => {
		const section = setup().panels[2]!;
		expect(find(section, (el) => el.tagName === 'h4').map(textOf)).toEqual(['編輯', '切換', '版面']);
		expect(find(section, (el) => el.tagName === 'li').map(textOf)).toEqual([
			'點格子 → 打開那一週的任務：勾完成、換週、排進或新增任務',
			'點專案名稱 → 在右側開啟筆記',
			'勾「編輯分類與狀態」 → 改專案的分類，或改成暫停、完成、取消',
			'年 / 月，或按 M → 切換年視圖與月視圖',
			'◀ ▶ → 換年份或月份；今年、本月 回到現在',
			'T → 切換逐週與 Timeline（只在年視圖）',
			'? → 打開或關閉這個面板',
			'點圖例 → 把一類置頂；拖拉圖例 → 調整分類順序',
			'拖拉專案欄的右邊 → 調整欄寬',
		]);
		expect(find(section, (el) => el.tagName === 'kbd').map(textOf)).toEqual(['M', 'T', '?']);
		expect(find(section, (el) => ['button', 'input', 'select', 'a'].includes(el.tagName))).toHaveLength(0);
	});

	it('reuses chart classes and table ancestors for year-view samples', () => {
		const section = setup().panels[0]!;
		const pending = withClass(section, 'status-pending')[0]!;
		expect(pending.tagName).toBe('tr');
		expect(withClass(pending, 'bar-solid')[0]!.classes.has('bar')).toBe(true);
		expect(withClass(pending, 'pause-badge')[0]!.parentElement!.classes.has('proj-cell')).toBe(true);
		for (const cls of ['bar-solid', 'bar-settled', 'bar-dashed', 'bar-overflow', 'done']) {
			expect(withClass(section, cls).length).toBeGreaterThan(0);
			expect(withClass(section, cls).every((el) => el.classes.has('bar'))).toBe(true);
		}
		expect(withClass(section, 'today-col')[0]!.tagName).toBe('td');
		const warning = withClass(section, 'warn')[0]!;
		expect(warning.textContent).toBe('⚠');
		expect(warning.parentElement!.classes.has('proj-cell')).toBe(true);
		expect(warning.parentElement!.textContent).toBe('專案');
		const dot = withClass(section, 'cat-dot')[0]!;
		expect(dot.parentElement!.tagName).toBe('td');
		expect(dot.parentElement!.classes.has('proj-cell')).toBe(true);
	});

	it('reuses month styles and keeps the unscheduled sample out of chart tables', () => {
		const section = setup().panels[1]!;
		expect(withClass(section, 'mc-done')[0]!.textContent).toBe('✓ 任務');
		expect(withClass(section, 'mc-overdue')[0]!.textContent).toBe('任務');
		expect(withClass(section, 'mc-open')[0]!.textContent).toBe('任務');
		expect(withClass(section, 'gc-label')[0]!.cssProps).toEqual({ '--pd-calendar-color': '#4a7fd4' });
		expect(withClass(section, 'general-refresh')[0]!.textContent).toBe('↻');
		const count = withClass(section, 'help-unscheduled-count')[0]!;
		expect(count.tagName).toBe('span');
		expect(count.textContent).toBe('3');
		expect(count.parentElement!.classes.has('help-sample')).toBe(true);
		expect(withClass(section, 'month-grid')).toHaveLength(0);
		expect(find(section, (el) => ['button', 'input', 'select', 'a'].includes(el.tagName))).toHaveLength(0);
	});

	it('closes the panel with the existing close button', () => {
		const context = setup();
		context.fixture.toggleHelpPanel(true);
		withClass(context.panel, 'close-btn')[0]!.dispatchEvent(new Event('click'));
		expect(context.panel.hidden).toBe(true);
		expect(context.fixture.helpFabEl.hidden).toBe(false);
	});

	it('limits panel height with internal scrolling and marks the selected tab twice', () => {
		const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
		const panelRules = css.match(/\.project-dashboard #help-panel \{([^}]+)\}/)![1]!;
		expect(panelRules).toMatch(/max-height:\s*calc\(100vh - 32px\)/);
		expect(panelRules).toMatch(/overflow-y:\s*auto/);
		expect(panelRules).toMatch(/max-width:\s*calc\(100vw - 32px\)/);
		const activeTab = css.match(/\.help-tabs \[aria-selected="true"\] \{([^}]+)\}/)![1]!;
		expect(activeTab).toMatch(/font-weight:\s*700/);
		expect(activeTab).toMatch(/border-bottom-color:\s*var\(--interactive-accent\)/);
		expect(css).toMatch(/grid-template-columns:\s*64px minmax\(0, 1fr\)/);
	});
});
