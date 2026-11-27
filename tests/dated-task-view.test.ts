import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceLeaf } from 'obsidian';
import * as cellModel from '../src/core/cells';
import * as monthModel from '../src/core/months';
import { scanProjectNote, type ProjectRecord } from '../src/core/scan';
import { defaultSettings } from '../src/core/settings';
import type ProjectDashboardPlugin from '../src/main';
import { MonthView } from '../src/month-view';
import type { VaultSource } from '../src/vault-source';
import { ProjectDashboardView } from '../src/view';
import { CLOSED_POPOVER_STATE } from '../src/week-popover';
import { SettingsElement } from './stubs/obsidian';

const settings = { ...defaultSettings(), saturdayCountsAsNextWeek: true };
type Scale = 'per-week' | 'timeline' | 'month';

function record(name: string, start: string, end: string, task = '', closed = false): ProjectRecord {
	const filename = `${closed ? '✅' : '🚧'} P-${name}.md`;
	return scanProjectNote({
		filename, path: `Projects/${filename}`,
		text: `---\n開始日期: ${start}\n預計結束日期: ${end}\n---\n${task}`,
	}, { overrides: {}, today: '2026-11-20', settings })!;
}

function find(el: SettingsElement, matches: (el: SettingsElement) => boolean): SettingsElement[] {
	return [...(matches(el) ? [el] : []), ...el.children.flatMap((child) => find(child, matches))];
}

function setup(projects: ProjectRecord[], scale: Scale, month = 11) {
	const view = new ProjectDashboardView({} as WorkspaceLeaf, {} as VaultSource, {
		store: { data: { settings, categoryOverrides: {} } },
	} as unknown as ProjectDashboardPlugin);
	const renderPopover = vi.fn();
	const fixture = view as unknown as {
		projects: ProjectRecord[];
		chartEl: SettingsElement;
		shownYear: number;
		today: string;
		categoryOrder: string[];
		showClosed: boolean;
		showPaused: boolean;
		viewMode: 'per-week' | 'timeline';
		scale: 'year' | 'month';
		popover: { render: typeof renderPopover };
		positionWeekPopover: () => void;
		renderYearChart(): void;
		isOverflowAnchor(el: HTMLElement): boolean;
		openWeekPopover(target: { kind: 'week'; path: string; week: string }, anchor: HTMLElement, state: typeof CLOSED_POPOVER_STATE): void;
		renderBar(td: HTMLTableCellElement, cell: cellModel.Cell, project: ProjectRecord, state: string, label: string, index: number): void;
	};
	Object.assign(fixture, {
		projects, chartEl: new SettingsElement(), shownYear: 2026, today: '2026-11-20',
		// 這裡驗的是色條與格子的畫法，不是季的折疊；固定四季展開，整年 53 欄都畫出來。
		foldYear: 2026, foldedQuarters: new Set<number>(),
		categoryOrder: ['other'], showClosed: true, showPaused: true,
		viewMode: scale === 'timeline' ? 'timeline' : 'per-week', scale: scale === 'month' ? 'month' : 'year',
		popover: { render: renderPopover }, positionWeekPopover: vi.fn(),
	});
	const render = () => {
		if (scale !== 'month') fixture.renderYearChart();
		else new MonthView({
			projects: () => projects, weeks: () => monthModel.weeksOfMonth(2026, month),
			settings: () => settings, today: () => fixture.today,
			categoryOrder: () => ['other'], calendarRow: () => null,
		}).render(fixture.chartEl as unknown as HTMLElement);
	};
	const rowFor = (project: ProjectRecord) => find(fixture.chartEl, (el) => el.tagName === 'tr'
		&& find(el, (child) => child.classes.has('name') && child.dataset.path === project.path).length > 0)[0]!;
	return { fixture, render, rowFor, renderPopover };
}

afterEach(() => vi.restoreAllMocks());

describe('dated task rendering and popover anchors', () => {
	it.each(['per-week', 'month'] as const)('opens a Saturday overflow task with the expected-end header in %s', (scale) => {
		const p = record('範例專案 A', '2026-06-29', '2026-11-06', '- [ ] 追蹤款項 📅 2026-12-05');
		const { fixture, render, rowFor, renderPopover } = setup([p], scale, 12);
		render();
		const anchor = find(rowFor(p), (el) => el.dataset.week === '2026-W50')[0]!;
		expect(anchor).toBeDefined();
		if (scale === 'month') {
			expect(anchor.dataset.kind).toBe('overflow');
			expect(find(anchor, (el) => el.classes.has('mc-line'))[0]!.textContent).toBe('追蹤款項');
		} else expect(anchor.classes.has('bar-overflow')).toBe(true);
		expect(fixture.isOverflowAnchor(anchor as unknown as HTMLElement)).toBe(true);
		fixture.openWeekPopover({ kind: 'week', path: p.path, week: '2026-W50' }, anchor as unknown as HTMLElement, CLOSED_POPOVER_STATE);
		expect(renderPopover).toHaveBeenCalledWith(expect.objectContaining({
			projectName: p.name, weekLabel: '2026-W50', overflowEnd: '2026-11-06',
			rows: [expect.objectContaining({ text: '追蹤款項' })],
		}), CLOSED_POPOVER_STATE);
	});

	it.each(['per-week', 'month'] as const)('opens a task before start in %s', (scale) => {
		const p = record('範例專案 B', '2026-11-02', '2026-12-31', '- [ ] 前置作業 📅 2026-10-28');
		const { fixture, render, rowFor, renderPopover } = setup([p], scale, 10);
		render();
		const anchor = find(rowFor(p), (el) => el.dataset.week === '2026-W44')[0]!;
		expect(anchor).toBeDefined();
		expect(scale === 'month' ? anchor.dataset.kind : anchor.classes.has('bar-solid')).toBe(scale === 'month' ? 'solid' : true);
		fixture.openWeekPopover({ kind: 'week', path: p.path, week: '2026-W44' }, anchor as unknown as HTMLElement, CLOSED_POPOVER_STATE);
		expect(renderPopover).toHaveBeenCalledWith(expect.objectContaining({
			overflowEnd: null, rows: [expect.objectContaining({ text: '前置作業' })],
		}), CLOSED_POPOVER_STATE);
	});

	it('renders a closed project’s task after its end with closed styling', () => {
		const p = record('範例專案 C', '2026-01-01', '2026-01-31', '- [x] 結案報告 📅 2026-02-10 ✅ 2026-02-10', true);
		const { render, rowFor } = setup([p], 'per-week');
		render();
		const bar = find(rowFor(p), (el) => el.classes.has('bar'))[0]!;
		expect(bar.dataset.week).toBe('2026-W07');
		expect(bar.classes.has('bar-solid')).toBe(true);
		expect(bar.classes.has('done')).toBe(true);
		expect(bar.classes.has('bar-overflow')).toBe(false);
	});

	it.each(['done', 'cancelled'] as const)('renders a %s timeline as a single solid bar', (status) => {
		const p = { ...record('範例專案 D', '2026-01-01', '2026-01-31'), status };
		const { render, rowFor } = setup([p], 'timeline');
		render();
		const bars = find(rowFor(p), (el) => el.classes.has('bar'));
		expect(bars).toHaveLength(1);
		expect(bars[0]!.classes.has('bar-solid')).toBe(true);
		expect(bars[0]!.classes.has(status)).toBe(true);
	});
});

describe('one project cannot break the dashboard', () => {
	it.each(['per-week', 'timeline', 'month'] as const)('renders year 9999 and the other rows under 50 ms in %s', (scale) => {
		const far = record('範例專案 E', '2026-01-01', '9999-12-31');
		const normal = record('範例專案 F', '2026-01-01', '2026-12-31', '- [ ] 任務 📅 2026-11-17');
		const { render, rowFor } = setup([far, normal], scale);
		const start = performance.now();
		render();
		const elapsed = performance.now() - start;
		expect(elapsed).toBeLessThan(50);
		for (const project of [far, normal]) {
			const row = rowFor(project);
			expect(row).toBeDefined();
			expect(find(row, (el) => el.classes.has('warn'))).toHaveLength(0);
			expect(find(row, (el) => el.classes.has(scale === 'month' ? 'month-cell' : 'week-cell'))).toHaveLength(scale === 'month' ? 5 : 53);
		}
		expect(find(rowFor(normal), (el) => el.dataset.week === '2026-W47')).toHaveLength(scale === 'timeline' ? 0 : 1);
	});

	for (const scale of ['per-week', 'timeline', 'month'] as const) {
		it.each(['derivation', 'partial rendering'] as const)(`isolates a failed row in ${scale}: %s`, (stage) => {
			const before = record('範例專案 G', '2026-01-01', '2026-12-31', '- [ ] 任務 📅 2026-11-17');
			const bad = record('範例專案 H', '2026-01-02', '2026-12-31', '- [ ] 任務 📅 2026-11-17');
			const after = record('範例專案 I', '2026-01-03', '2026-12-31', '- [ ] 任務 📅 2026-11-17');
			const { fixture, render, rowFor } = setup([before, bad, after], scale);
			const error = vi.spyOn(console, 'error').mockImplementation(() => {});
			if (stage === 'derivation') {
				if (scale === 'month') {
					const derive = cellModel.monthViewCells;
					vi.spyOn(cellModel, 'monthViewCells').mockImplementation((p, ...args) => {
						if (p === bad) throw new Error('private task content');
						return derive(p, ...args);
					});
				} else {
					const derive = cellModel.yearViewCells;
					vi.spyOn(cellModel, 'yearViewCells').mockImplementation((p, ...args) => {
						if (p === bad) throw new Error('private task content');
						return derive(p, ...args);
					});
				}
			} else if (scale === 'month') {
				const summary = monthModel.unscheduledSummary;
				vi.spyOn(monthModel, 'unscheduledSummary').mockImplementation((p) => {
					if (p === bad) throw new Error('private task content');
					return summary(p);
				});
			} else {
				const renderBar = fixture.renderBar.bind(fixture);
				vi.spyOn(fixture, 'renderBar').mockImplementation((td, cell, p, ...args) => {
					renderBar(td, cell, p, ...args);
					if (p === bad && cell.kind !== 'blank') throw new Error('private task content');
				});
			}
			expect(render).not.toThrow();
			const row = rowFor(bad);
			expect(row).toBeDefined();
			const warnings = find(row, (el) => el.classes.has('warn'));
			expect(warnings).toHaveLength(1);
			expect(warnings[0]!.textContent).toBe('⚠');
			expect(warnings[0]!.attributes.get('title')).toBe('這個專案的日期有問題');
			const head = row.children[0]!;
			expect(head.children.map((el) => el.textContent)).toEqual([bad.name, '⚠']);
			const blanks = find(row, (el) => el.classes.has(scale === 'month' ? 'month-cell' : 'week-cell'));
			expect(blanks).toHaveLength(scale === 'month' ? 5 : 53);
			expect(blanks.every((el) => el.children.length === 0 && el.textContent === '' && el.dataset.path === undefined)).toBe(true);
			expect(find(row, (el) => el.classes.has('bar') || el.classes.has('mc-line'))).toHaveLength(0);
			if (scale === 'month') expect(find(row, (el) => el.classes.has('month-unscheduled'))[0]!.dataset.path).toBeUndefined();
			for (const healthy of [before, after]) {
				expect(find(rowFor(healthy), (el) => el.classes.has('warn'))).toHaveLength(0);
				expect(find(rowFor(healthy), (el) => el.classes.has(scale === 'month' ? 'mc-line' : 'bar')).length).toBeGreaterThan(0);
			}
			expect(error.mock.calls).toEqual([[bad.name]]);
		});
	}
});
