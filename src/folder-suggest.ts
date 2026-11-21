import { AbstractInputSuggest, type App } from 'obsidian';

export function folderSuggestions(paths: string[], query: string): string[] {
	const search = query.trim().toLowerCase();
	return paths
		.filter((path) => path !== '' && path !== '/' && path.toLowerCase().includes(search))
		.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }) || (a < b ? -1 : a > b ? 1 : 0));
}

export class ProjectFolderSuggest extends AbstractInputSuggest<string> {
	private hasTyped = false;

	constructor(app: App, inputEl: HTMLInputElement, private readonly onPick: (path: string) => void) {
		super(app, inputEl);
		// Obsidian 在 input 事件裡就重新取得建議；beforeinput 一定更早，第一個字才能立即篩選。
		inputEl.addEventListener('beforeinput', () => { this.hasTyped = true; });
		inputEl.addEventListener('blur', () => { this.hasTyped = false; });
	}

	protected getSuggestions(query: string): string[] {
		const paths = this.app.vault.getAllFolders(false).map((folder) => folder.path);
		return folderSuggestions(paths, this.hasTyped ? query : '');
	}

	renderSuggestion(path: string, el: HTMLElement): void {
		el.setText(path);
	}

	selectSuggestion(path: string): void {
		this.setValue(path);
		this.close();
		this.onPick(path);
	}
}
