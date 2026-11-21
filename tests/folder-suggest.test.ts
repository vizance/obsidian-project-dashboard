import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { folderSuggestions, ProjectFolderSuggest } from '../src/folder-suggest';
import { SettingsElement, TFolder, Vault } from './stubs/obsidian';

const PATHS = ['Work/Projects', 'Archive', 'Projects', 'Work', '/'];
const ALL_FOLDERS = ['Archive', 'Projects', 'Work', 'Work/Projects'];

function inputElement(value = 'Projects'): HTMLInputElement {
	return Object.assign(new EventTarget(), { value }) as unknown as HTMLInputElement;
}

function setup() {
	const vault = new Vault();
	for (const path of PATHS) vault.setAbstractFile(new TFolder(path));
	const getAllFolders = vi.spyOn(vault, 'getAllFolders');
	const inputEl = inputElement();
	const onPick = vi.fn<(path: string) => void>();
	const suggest = new ProjectFolderSuggest({ vault } as unknown as App, inputEl, onPick);
	// 真實基底把查詢方法設為 protected；透過行為介面呼叫，避免依賴實作的可見性。
	const queryable = suggest as unknown as { getSuggestions(query: string): string[] };
	return { suggest, queryable, inputEl, onPick, getAllFolders };
}

describe('folderSuggestions', () => {
	it('Clicking the folder field lists every folder', () => {
		expect(folderSuggestions(PATHS, '')).toEqual(ALL_FOLDERS);
	});

	it.each(['proj', '  PROJ  '])('Typing narrows the folder list with query %j', (query) => {
		expect(folderSuggestions(PATHS, query)).toEqual(['Projects', 'Work/Projects']);
	});

	it('matches text in the middle of a path', () => {
		expect(folderSuggestions(PATHS, 'ork/p')).toEqual(['Work/Projects']);
	});

	it('returns an empty list when no folder matches', () => {
		expect(folderSuggestions(PATHS, 'missing')).toEqual([]);
	});

	it('excludes empty paths as well as the vault root', () => {
		expect(folderSuggestions(['', ...PATHS], '')).toEqual(ALL_FOLDERS);
	});

	it('sorts paths without regard to case', () => {
		expect(folderSuggestions(['beta', 'Alpha', 'alpha2'], '')).toEqual(['Alpha', 'alpha2', 'beta']);
	});
});

describe('ProjectFolderSuggest', () => {
	it('lists every folder before typing even when the field already holds Projects', () => {
		const { queryable, getAllFolders } = setup();
		expect(queryable.getSuggestions('Projects')).toEqual(ALL_FOLDERS);
		expect(getAllFolders).toHaveBeenCalledExactlyOnceWith(false);
	});

	it('filters from the first beforeinput event', () => {
		const { queryable, inputEl } = setup();
		inputEl.dispatchEvent(new Event('beforeinput'));
		inputEl.value = 'proj';
		expect(queryable.getSuggestions('proj')).toEqual(['Projects', 'Work/Projects']);
	});

	it('resets to every folder after blur', () => {
		const { queryable, inputEl } = setup();
		inputEl.dispatchEvent(new Event('beforeinput'));
		expect(queryable.getSuggestions('proj')).toEqual(['Projects', 'Work/Projects']);
		inputEl.dispatchEvent(new Event('blur'));
		inputEl.value = 'Projects';
		expect(queryable.getSuggestions('Projects')).toEqual(ALL_FOLDERS);
	});

	it('fills the selected path, closes the list and calls onPick once', () => {
		const { suggest, inputEl, onPick } = setup();
		const state = suggest as unknown as { isOpen: boolean };
		suggest.open();
		expect(state.isOpen).toBe(true);
		suggest.selectSuggestion('Work/Projects');
		expect(inputEl.value).toBe('Work/Projects');
		expect(state.isOpen).toBe(false);
		expect(onPick).toHaveBeenCalledExactlyOnceWith('Work/Projects');
	});

	it('renders the folder path as text', () => {
		const { suggest } = setup();
		const el = new SettingsElement();
		const setText = vi.spyOn(el, 'setText');
		suggest.renderSuggestion('Work/Projects', el as unknown as HTMLElement);
		expect(el.textContent).toBe('Work/Projects');
		expect(setText).toHaveBeenCalledExactlyOnceWith('Work/Projects');
	});
});
