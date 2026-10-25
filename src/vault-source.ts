import { TFile, TFolder, type EventRef } from 'obsidian';
import { PROJECT_FOLDER } from './core/config';
import { scanProjectFolder, type ProjectRecord, type ScanInput } from './core/scan';
import { createDebouncer, isRelevantChange } from './core/sync-rules';

export type ScanResult =
	| { status: 'ok'; projects: ProjectRecord[] }
	| { status: 'missing-folder'; folder: string };

// Only the `path` field is needed before an `instanceof TFile`/`TFolder` check
// narrows to the real class. Keeping this minimal (instead of typing against
// the full TAbstractFile) lets tests/stubs/obsidian.ts stay small.
interface PathedFile {
	path: string;
}

// The narrow slice of Obsidian's Vault that VaultSource actually calls. Typing
// against this instead of the full App/Vault type lets the real app.vault be
// passed in without casts, and lets a minimal test stub satisfy it too.
export interface VaultLike {
	getAbstractFileByPath(path: string): PathedFile | null;
	cachedRead(file: PathedFile): Promise<string>;
	on(name: 'modify' | 'create' | 'delete', callback: (file: PathedFile) => unknown): EventRef;
	on(name: 'rename', callback: (file: PathedFile, oldPath: string) => unknown): EventRef;
}

interface EventRegistrar {
	registerEvent(eventRef: EventRef): void;
}

// Owns every vault read so the view never has to know about TFolder/TFile or
// the project-note path rule directly (design.md: "資料來源層集中所有 vault 讀取").
export class VaultSource {
	private readonly listeners = new Set<() => void>();
	private readonly debouncer = createDebouncer(
		400,
		{ set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
		() => this.notifyListeners(),
	);

	constructor(
		private readonly vault: VaultLike,
		private readonly getOverrides: () => Record<string, string>,
		private readonly folder: string = PROJECT_FOLDER,
	) {}

	async scan(today: string): Promise<ScanResult> {
		const abstractFolder = this.vault.getAbstractFileByPath(this.folder);
		if (!(abstractFolder instanceof TFolder)) {
			return { status: 'missing-folder', folder: this.folder };
		}

		const inputs: ScanInput[] = [];
		for (const child of abstractFolder.children) {
			if (!(child instanceof TFile) || child.extension !== 'md') continue;
			try {
				const text = await this.vault.cachedRead(child);
				inputs.push({ filename: child.name, text, path: child.path });
			} catch (err) {
				console.warn(`[project-dashboard] 讀取筆記失敗：${child.path}`, err);
			}
		}

		const projects = scanProjectFolder(inputs, { overrides: this.getOverrides(), today });
		return { status: 'ok', projects };
	}

	// Called once from Plugin#onload; registered through the plugin so Obsidian
	// unregisters the listeners automatically on unload.
	registerVaultEvents(plugin: EventRegistrar): void {
		const notifyIfRelevant = (path: string, oldPath?: string): void => {
			if (this.listeners.size === 0) return;
			if (!isRelevantChange(path, oldPath, this.folder)) return;
			this.debouncer.trigger();
		};
		plugin.registerEvent(this.vault.on('modify', (file) => notifyIfRelevant(file.path)));
		plugin.registerEvent(this.vault.on('create', (file) => notifyIfRelevant(file.path)));
		plugin.registerEvent(this.vault.on('delete', (file) => notifyIfRelevant(file.path)));
		plugin.registerEvent(this.vault.on('rename', (file, oldPath) => notifyIfRelevant(file.path, oldPath)));
	}

	onChange(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => {
			this.listeners.delete(cb);
		};
	}

	private notifyListeners(): void {
		for (const cb of this.listeners) cb();
	}
}
