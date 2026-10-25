// Minimal stand-in for the parts of the `obsidian` module that src/vault-source.ts touches.
// Real plugin code runs against the real API; this file only has to satisfy the vitest alias.

export abstract class TAbstractFile {
	path: string;
	name: string;

	constructor(path: string) {
		this.path = path;
		const slash = path.lastIndexOf('/');
		this.name = slash === -1 ? path : path.slice(slash + 1);
	}
}

export class TFile extends TAbstractFile {
	extension: string;

	constructor(path: string) {
		super(path);
		const dot = this.name.lastIndexOf('.');
		this.extension = dot === -1 ? '' : this.name.slice(dot + 1);
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

export type EventRef = { name: VaultEventName; callback: (...args: never[]) => unknown };

type VaultEventName = 'modify' | 'create' | 'delete' | 'rename';

export class Vault {
	private readonly abstractFiles = new Map<string, TAbstractFile>();
	private readonly contents = new Map<string, string>();
	private readonly failingReads = new Set<string>();
	private readonly handlers: Record<VaultEventName, Array<(...args: never[]) => unknown>> = {
		modify: [],
		create: [],
		delete: [],
		rename: [],
	};

	setAbstractFile(file: TAbstractFile): void {
		this.abstractFiles.set(file.path, file);
	}

	setFileContent(path: string, content: string): void {
		this.contents.set(path, content);
	}

	setReadFailure(path: string): void {
		this.failingReads.add(path);
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		return this.abstractFiles.get(path) ?? null;
	}

	async cachedRead(file: TFile): Promise<string> {
		if (this.failingReads.has(file.path)) {
			throw new Error(`stub read failure: ${file.path}`);
		}
		return this.contents.get(file.path) ?? '';
	}

	on(name: VaultEventName, callback: (...args: never[]) => unknown): EventRef {
		this.handlers[name].push(callback);
		return { name, callback };
	}

	trigger(name: VaultEventName, ...args: unknown[]): void {
		for (const callback of this.handlers[name]) {
			(callback as (...a: unknown[]) => unknown)(...args);
		}
	}
}

export class Plugin {
	registerEvent(_eventRef: EventRef): void {
		// no-op: real Plugin unregisters this on unload, not needed for these tests.
	}
}
