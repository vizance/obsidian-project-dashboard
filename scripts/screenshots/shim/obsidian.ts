// Browser-only stand-in. All persistence and calendar responses stay in memory.
type ElementOptions = DomElementInfo | string;

function createElement<K extends keyof HTMLElementTagNameMap>(
	this: Node,
	tag: K,
	options: ElementOptions = {},
	callback?: (el: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
	const info = typeof options === 'string' ? { cls: options } : options;
	const doc = this.ownerDocument ?? document;
	const el = doc.createElement(tag);
	if (info.cls) el.className = Array.isArray(info.cls) ? info.cls.join(' ') : info.cls;
	if (typeof info.text === 'string') el.textContent = info.text;
	else if (info.text) el.appendChild(info.text);
	for (const [key, value] of Object.entries(info.attr ?? {})) {
		if (value !== null) el.setAttribute(key, String(value));
	}
	for (const key of ['title', 'value', 'type', 'placeholder', 'href'] as const) {
		if (info[key] !== undefined) el.setAttribute(key, info[key]);
	}
	const parent = info.parent ?? this;
	if (info.prepend) parent.insertBefore(el, parent.firstChild);
	else parent.appendChild(el);
	callback?.(el);
	return el;
}

Object.assign(Node.prototype, {
	createEl: createElement,
	createDiv(this: Node, options?: ElementOptions, callback?: (el: HTMLDivElement) => void) {
		const el = createElement.call(this, 'div', options) as HTMLDivElement;
		callback?.(el);
		return el;
	},
	createSpan(this: Node, options?: ElementOptions, callback?: (el: HTMLSpanElement) => void) {
		const el = createElement.call(this, 'span', options) as HTMLSpanElement;
		callback?.(el);
		return el;
	},
	empty(this: Node) { while (this.firstChild) this.removeChild(this.firstChild); },
	setText(this: Node, text: string) { this.textContent = text; },
	appendText(this: Node, text: string) { this.appendChild((this.ownerDocument ?? document).createTextNode(text)); },
});
Object.assign(Element.prototype, {
	addClass(this: Element, ...names: string[]) { this.classList.add(...names.flatMap((name) => name.split(' ')).filter(Boolean)); },
	removeClass(this: Element, ...names: string[]) { this.classList.remove(...names.flatMap((name) => name.split(' ')).filter(Boolean)); },
	toggleClass(this: Element, name: string, enabled: boolean) { this.classList.toggle(name, enabled); },
	hasClass(this: Element, name: string) { return this.classList.contains(name); },
});
Object.assign(HTMLElement.prototype, {
	setCssProps(this: HTMLElement, props: Record<string, string>) {
		for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
	},
	// The demo never migrates a tab into another window.
	onWindowMigrated() { return () => {}; },
});
Object.assign(globalThis, { activeDocument: document, activeWindow: window });

export abstract class TAbstractFile {
	name: string;
	parent: TFolder | null = null;
	constructor(public path: string) { this.name = path.slice(path.lastIndexOf('/') + 1); }
}
export class TFile extends TAbstractFile {
	get extension(): string { return this.name.slice(this.name.lastIndexOf('.') + 1); }
	get basename(): string { return this.name.slice(0, this.name.lastIndexOf('.')); }
}
export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
}

type VaultCallback = (file: TAbstractFile, oldPath: string) => unknown;
export interface EventRef { off(): void; }
export class Vault {
	private files = new Map<string, TAbstractFile>();
	private contents = new Map<TFile, string>();
	private handlers = new Map<string, Set<VaultCallback>>();
	addFolder(path: string): TFolder {
		const folder = new TFolder(path);
		this.files.set(path, folder);
		return folder;
	}
	addFile(folder: TFolder, filename: string, content: string): TFile {
		const file = new TFile(`${folder.path}/${filename}`);
		file.parent = folder;
		folder.children.push(file);
		this.files.set(file.path, file);
		this.contents.set(file, content);
		return file;
	}
	getAbstractFileByPath(path: string): TAbstractFile | null { return this.files.get(path) ?? null; }
	async cachedRead(file: { path: string }): Promise<string> {
		const found = this.files.get(file.path);
		if (!(found instanceof TFile)) throw new Error('找不到範例筆記');
		return this.contents.get(found) ?? '';
	}
	read(file: TFile): Promise<string> { return this.cachedRead(file); }
	async process(file: TFile, fn: (content: string) => string): Promise<string> {
		const next = fn(await this.read(file));
		this.contents.set(file, next);
		this.trigger('modify', file);
		return next;
	}
	on(name: string, callback: VaultCallback): EventRef {
		let handlers = this.handlers.get(name);
		if (!handlers) this.handlers.set(name, handlers = new Set());
		handlers.add(callback);
		return { off: () => { handlers.delete(callback); } };
	}
	trigger(name: string, file: TAbstractFile, oldPath?: string): void {
		for (const callback of this.handlers.get(name) ?? []) callback(file, oldPath ?? '');
	}
	async rename(file: TFile, path: string): Promise<void> {
		if (this.files.has(path)) throw new Error('範例筆記名稱已存在');
		const oldPath = file.path;
		this.files.delete(oldPath);
		file.path = path;
		file.name = path.slice(path.lastIndexOf('/') + 1);
		this.files.set(path, file);
		this.trigger('rename', file, oldPath);
	}
}

export class Scope {
	private handlers: Array<{ modifiers: string[]; key: string; callback: (event: KeyboardEvent) => boolean }> = [];
	constructor(public parent?: Scope) {}
	register(modifiers: string[], key: string, callback: (event: KeyboardEvent) => boolean): void {
		this.handlers.push({ modifiers, key, callback });
	}
	handle(event: KeyboardEvent): void {
		const modifiers = [event.shiftKey ? 'Shift' : '', event.ctrlKey ? 'Ctrl' : '', event.metaKey ? 'Meta' : '', event.altKey ? 'Alt' : ''].filter(Boolean);
		for (const handler of this.handlers) {
			if (event.key !== handler.key || modifiers.join() !== handler.modifiers.join()) continue;
			if (handler.callback(event) === false) { event.preventDefault(); return; }
		}
	}
}
class Component {
	private cleanups: Array<() => void> = [];
	register(cleanup: () => void): void { this.cleanups.push(cleanup); }
	registerEvent(ref: EventRef): void { this.register(() => ref.off()); }
	registerDomEvent(target: EventTarget, name: string, callback: (event: never) => void, options?: boolean): void {
		const listener = callback as EventListener;
		target.addEventListener(name, listener, options);
		this.register(() => target.removeEventListener(name, listener, options));
	}
	unload(): void { for (const cleanup of this.cleanups.splice(0).reverse()) cleanup(); }
}
export class ItemView extends Component {
	app: App;
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	scope?: Scope;
	constructor(public leaf: WorkspaceLeaf) {
		super();
		this.app = leaf.app;
		this.containerEl = leaf.containerEl;
		this.containerEl.createDiv({ cls: 'view-header', attr: { hidden: '' } });
		this.contentEl = this.containerEl.createDiv({ cls: 'view-content' });
		this.registerDomEvent(document, 'keydown', (event: KeyboardEvent) => this.scope?.handle(event));
	}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
}
export class MarkdownView {
	// Note navigation is outside the screenshot scenarios; retain the editor shape.
	editor = {
		getValue: () => '',
		setSelection: (_from: unknown, _to: unknown) => {},
		scrollIntoView: (_range: unknown, _center: boolean) => {},
		focus: () => {},
	};
	constructor(public file: TFile) {}
}
export class WorkspaceLeaf {
	view: ItemView | MarkdownView | null = null;
	constructor(public app: App, public containerEl: HTMLElement) {}
	async setViewState(state: { type: string; active?: boolean }): Promise<void> {
		const factory = this.app.workspace.factories.get(state.type);
		if (!factory) throw new Error('找不到範例畫面');
		this.view = factory(this);
		await this.view.onOpen();
	}
	async openFile(file: TFile): Promise<void> { this.view = new MarkdownView(file); }
}
class Workspace {
	factories = new Map<string, (leaf: WorkspaceLeaf) => ItemView>();
	leaves: WorkspaceLeaf[] = [];
	constructor(private app: App) {}
	getLeaf(_mode?: string): WorkspaceLeaf {
		const leaf = new WorkspaceLeaf(this.app, this.app.root.createDiv({ cls: 'workspace-leaf-content' }));
		this.leaves.push(leaf);
		return leaf;
	}
	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return this.leaves.filter((leaf) => leaf.view instanceof ItemView && (leaf.view as ItemView & { getViewType(): string }).getViewType() === type);
	}
	createLeafBySplit(_leaf: WorkspaceLeaf, _direction: string): WorkspaceLeaf { return this.getLeaf(); }
	iterateAllLeaves(callback: (leaf: WorkspaceLeaf) => void): void { this.leaves.forEach(callback); }
	async revealLeaf(_leaf: WorkspaceLeaf): Promise<void> {}
	setActiveLeaf(_leaf: WorkspaceLeaf, _options?: unknown): void {}
}
class SecretStorage {
	private values = new Map<string, string>();
	getSecret(id: string): string | null { return this.values.get(id) ?? null; }
	setSecret(id: string, value: string): void { this.values.set(id, value); }
	listSecrets(): string[] { return [...this.values.keys()]; }
}
export class App {
	vault = new Vault();
	workspace = new Workspace(this);
	scope = new Scope();
	secretStorage = new SecretStorage();
	fileManager = { renameFile: (file: TFile, path: string) => this.vault.rename(file, path) };
	pluginData: unknown = null;
	private preferences = new Map<string, string>();
	constructor(public root: HTMLElement) {}
	loadLocalStorage(key: string): string | null { return this.preferences.get(key) ?? null; }
	saveLocalStorage(key: string, value: string): void { this.preferences.set(key, value); }
}
export class Plugin extends Component {
	settingTabs: PluginSettingTab[] = [];
	constructor(public app: App, _manifest?: unknown) { super(); }
	async loadData(): Promise<unknown> { return structuredClone(this.app.pluginData); }
	async saveData(data: unknown): Promise<void> { this.app.pluginData = structuredClone(data); }
	registerView(type: string, factory: (leaf: WorkspaceLeaf) => ItemView): void { this.app.workspace.factories.set(type, factory); }
	addSettingTab(tab: PluginSettingTab): void { this.settingTabs.push(tab); }
	addRibbonIcon(_icon: string, _title: string, _callback: () => void): void {}
	addCommand(_command: unknown): void {}
}
export class PluginSettingTab {
	containerEl = document.createElement('div');
	constructor(public app: App, _plugin: Plugin) { this.containerEl.className = 'vertical-tab-content'; }
	display(): void {}
	hide(): void {}
}
export class Notice {
	constructor(message: string) {
		const el = document.body.createDiv({ cls: 'notice', text: message });
		window.setTimeout(() => el.remove(), 4000);
	}
}

let calendarResponses: Readonly<Record<string, string>> = {};
export function setCalendarResponses(responses: Readonly<Record<string, string>>): void { calendarResponses = responses; }
export async function requestUrl(options: { url: string; method?: string; throw?: boolean }): Promise<{ status: number; text: string }> {
	// Never fall back to fetch: a changed demo URL must fail locally.
	const text = calendarResponses[options.url];
	return { status: text === undefined ? 404 : 200, text: text ?? '' };
}
export function setTooltip(el: HTMLElement, text: string): void { el.title = text; el.setAttribute('aria-label', text); }

class TextComponent<T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
	constructor(public inputEl: T) {}
	setValue(value: string): this { this.inputEl.value = value; return this; }
	getValue(): string { return this.inputEl.value; }
	setPlaceholder(value: string): this { this.inputEl.setAttribute('placeholder', value); return this; }
	onChange(callback: (value: string) => void): this {
		this.inputEl.addEventListener(this.inputEl.tagName === 'SELECT' ? 'change' : 'input', () => callback(this.getValue()));
		return this;
	}
}
class DropdownComponent extends TextComponent<HTMLSelectElement> {
	addOption(value: string, label: string): this { this.inputEl.createEl('option', { text: label, attr: { value } }); return this; }
}
class ToggleComponent {
	constructor(public inputEl: HTMLInputElement, private toggleEl: HTMLElement) {}
	setValue(value: boolean): this { this.inputEl.checked = value; this.toggleEl.toggleClass('is-enabled', value); return this; }
	onChange(callback: (value: boolean) => void): this {
		this.inputEl.addEventListener('change', () => { this.setValue(this.inputEl.checked); callback(this.inputEl.checked); });
		return this;
	}
}
class ButtonComponent {
	constructor(public buttonEl: HTMLButtonElement) {}
	setButtonText(value: string): this { this.buttonEl.textContent = value; return this; }
	setTooltip(value: string): this { setTooltip(this.buttonEl, value); return this; }
	setDisabled(value: boolean): this { this.buttonEl.disabled = value; return this; }
	setIcon(value: string): this {
		const paths: Record<string, string> = {
			'arrow-up': 'M12 19V5m-7 7 7-7 7 7',
			'arrow-down': 'M12 5v14m-7-7 7 7 7-7',
			trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
		};
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		for (const [key, val] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'aria-hidden': 'true' })) svg.setAttribute(key, val);
		const path = document.createElementNS(svg.namespaceURI, 'path');
		path.setAttribute('d', paths[value] ?? '');
		svg.appendChild(path);
		this.buttonEl.replaceChildren(svg);
		return this;
	}
	onClick(callback: () => void): this { this.buttonEl.addEventListener('click', callback); return this; }
}
export class Setting {
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;
	constructor(container: HTMLElement) {
		this.settingEl = container.createDiv({ cls: 'setting-item' });
		this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
		this.nameEl = this.infoEl.createDiv({ cls: 'setting-item-name' });
		this.descEl = this.infoEl.createDiv({ cls: 'setting-item-description' });
		this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
	}
	setName(value: string): this { this.nameEl.setText(value); return this; }
	setDesc(value: string): this { this.descEl.setText(value); return this; }
	setHeading(): this { this.settingEl.addClass('setting-item-heading'); return this; }
	addText(callback: (component: TextComponent<HTMLInputElement>) => void): this {
		callback(new TextComponent(this.controlEl.createEl('input', { attr: { type: 'text' } }))); return this;
	}
	addTextArea(callback: (component: TextComponent<HTMLTextAreaElement>) => void): this {
		callback(new TextComponent(this.controlEl.createEl('textarea', { attr: { rows: 3 } }))); return this;
	}
	addDropdown(callback: (component: DropdownComponent) => void): this {
		callback(new DropdownComponent(this.controlEl.createEl('select', { cls: 'dropdown' }))); return this;
	}
	addToggle(callback: (component: ToggleComponent) => void): this {
		const toggle = this.controlEl.createDiv({ cls: 'checkbox-container' });
		callback(new ToggleComponent(toggle.createEl('input', { attr: { type: 'checkbox' } }), toggle)); return this;
	}
	addColorPicker(callback: (component: TextComponent<HTMLInputElement>) => void): this {
		callback(new TextComponent(this.controlEl.createEl('input', { attr: { type: 'color' } }))); return this;
	}
	addButton(callback: (component: ButtonComponent) => void): this {
		callback(new ButtonComponent(this.controlEl.createEl('button', { attr: { type: 'button' } }))); return this;
	}
	addExtraButton(callback: (component: ButtonComponent) => void): this {
		callback(new ButtonComponent(this.controlEl.createEl('button', { cls: 'clickable-icon', attr: { type: 'button' } }))); return this;
	}
}
