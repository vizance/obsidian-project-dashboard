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

function setup() {
	// 沒有任何專案或設定資料，說明仍須完整可用。
	const view = new ProjectDashboardView({} as WorkspaceLeaf, {} as VaultSource, {} as ProjectDashboardPlugin);
	const fixture = view as unknown as {
		contentEl: SettingsElement;
		helpPanelEl: SettingsElement;
		registerDomEvent: ReturnType<typeof vi.fn>;
		buildHelpPanel(): void;
	};
	fixture.contentEl = new SettingsElement();
	fixture.registerDomEvent = vi.fn();
	fixture.buildHelpPanel();
	return { panel: fixture.helpPanelEl, registerDomEvent: fixture.registerDomEvent };
}

describe('static help panel', () => {
	it('contains the four sections in reading order without loaded project data', () => {
		const { panel } = setup();
		expect(panel.attributes.get('id')).toBe('help-panel');
		const sections = panel.children.filter((child) => child.tagName === 'section');
		expect(sections.map((section) => section.children[0]!.textContent)).toEqual(['快捷鍵', '圖示說明', '月視圖', '操作']);
		for (const cls of ['shortcuts', 'legend-visual', 'month-view-help', 'actions']) {
			expect(withClass(panel, cls)).toHaveLength(1);
		}
	});

	it('explains T, M and ? with their scope', () => {
		const section = withClass(setup().panel, 'shortcuts')[0]!;
		expect(find(section, (el) => el.tagName === 'kbd').map(textOf)).toEqual(['T', 'M', '?']);
		for (const text of ['切換週視圖 / Timeline，只作用在年視圖', '切換年 / 月', '顯示 / 隱藏面板']) {
			expect(textOf(section)).toContain(text);
		}
	});

	it('explains all nine year-view styles using the specified text', () => {
		const section = withClass(setup().panel, 'legend-visual')[0]!;
		expect(find(section, (el) => el.tagName === 'li')).toHaveLength(9);
		for (const text of [
			'該週有任務排定（尚未完成）',
			'該週任務已全部完成（settled）',
			'該週無任務（仍在專案區間）',
			'超出原訂結束日（scope creep）— 該回去更新 frontmatter 預計結束日期',
			'⏳ 暫停',
			'暫停的專案（勾「顯示暫停」才會出現）',
			'已完成或取消的專案（勾「顯示已結案」才會出現）',
			'今天所在的週',
			'日期有缺漏、是推算的，或有問題；滑過去看原因',
			'這週沒有任務，而且不在專案區間，或專案已結案',
		]) expect(textOf(section)).toContain(text);
	});

	it('explains task text, calendar labels and unscheduled counts in the month view', () => {
		const section = withClass(setup().panel, 'month-view-help')[0]!;
		expect(find(section, (el) => el.tagName === 'li')).toHaveLength(6);
		for (const text of [
			'已完成的任務',
			'週已過還沒完成的任務',
			'還沒完成、週還沒過的任務',
			'General 列',
			'行事曆的行程，只能看；按 ↻ 重新讀取',
			'行事曆名稱；顏色在設定頁改',
			'還沒排',
			'還沒排日期的任務；點一下排進這個月的某一週',
		]) expect(textOf(section)).toContain(text);
	});

	it('lists all six actions as text without adding interactive controls', () => {
		const { panel, registerDomEvent } = setup();
		const section = withClass(panel, 'actions')[0]!;
		expect(find(section, (el) => el.tagName === 'li').map(textOf)).toEqual([
			'點格子 → 打開那一週的任務，可以勾完成、換週、排進或新增任務',
			'點專案名稱 → 在右側開啟筆記',
			'◀ ▶ → 換年份或月份；今年、本月 回到現在',
			'勾「編輯分類與狀態」 → 改專案的分類與狀態',
			'拖拉或點圖例 → 調整分類順序，或把一類置頂',
			'拖拉專案欄的右邊 → 調整欄寬',
		]);
		expect(find(section, (el) => ['button', 'input', 'select', 'a'].includes(el.tagName))).toHaveLength(0);
		expect(find(panel, (el) => el.tagName === 'button')).toHaveLength(1);
		expect(registerDomEvent).toHaveBeenCalledOnce();
	});

	it('reuses chart classes and the required table ancestors for year-view samples', () => {
		const section = withClass(setup().panel, 'legend-visual')[0]!;
		const pending = withClass(section, 'status-pending')[0]!;
		expect(pending.tagName).toBe('tr');
		expect(withClass(pending, 'bar-solid')[0]!.classes.has('bar')).toBe(true);
		expect(withClass(pending, 'pause-badge')[0]!.parentElement!.classes.has('proj-cell')).toBe(true);
		expect(textOf(withClass(pending, 'pause-badge')[0]!)).toBe('⏳ 暫停');
		for (const cls of ['bar-solid', 'bar-settled', 'bar-dashed', 'bar-overflow', 'done']) {
			expect(withClass(section, cls).every((el) => el.classes.has('bar'))).toBe(true);
			expect(withClass(section, cls).length).toBeGreaterThan(0);
		}
		expect(withClass(section, 'today-col')[0]!.tagName).toBe('td');
		const warning = withClass(section, 'warn')[0]!;
		expect(warning.textContent).toBe('⚠');
		expect(warning.parentElement!.tagName).toBe('td');
		expect(warning.parentElement!.classes.has('proj-cell')).toBe(true);
		expect(warning.parentElement!.textContent).toBe('專案');
	});

	it('reuses month-view text, calendar color and unscheduled-cell styles', () => {
		const section = withClass(setup().panel, 'month-view-help')[0]!;
		expect(withClass(section, 'mc-done')[0]!.textContent).toBe('✓ 任務');
		expect(withClass(section, 'mc-overdue')[0]!.textContent).toBe('任務');
		expect(withClass(section, 'mc-open')[0]!.textContent).toBe('任務');
		expect(withClass(section, 'gc-label')[0]!.cssProps).toEqual({ '--pd-calendar-color': '#4a7fd4' });
		const unscheduled = withClass(section, 'month-unscheduled')[0]!;
		expect(unscheduled.tagName).toBe('td');
		expect(unscheduled.textContent).toBe('3');
		expect(unscheduled.parentElement!.parentElement!.parentElement!.classes.has('month-grid')).toBe(true);
		expect(unscheduled.dataset.path).toBeUndefined();
	});

	it('limits panel height to the viewport with internal vertical scrolling', () => {
		const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
		const panelRules = css.match(/\.project-dashboard #help-panel \{([^}]+)\}/)![1]!;
		expect(panelRules).toMatch(/max-height:\s*calc\(100vh - 32px\)/);
		expect(panelRules).toMatch(/overflow-y:\s*auto/);
	});
});
