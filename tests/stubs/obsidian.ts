// Minimal stand-in for the vault and settings APIs exercised by the tests.
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

	// Mirrors Obsidian's Vault.process: reads the current content, runs `fn`, and
	// writes the result back. A throw from `fn` leaves stored content untouched
	// and rejects, matching the real API's atomic-or-nothing behaviour.
	async process(file: TFile, fn: (data: string) => string): Promise<string> {
		const current = this.contents.get(file.path) ?? '';
		const next = fn(current);
		this.contents.set(file.path, next);
		return next;
	}

	getFileContent(path: string): string {
		return this.contents.get(path) ?? '';
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

// Obsidian 的 Platform。測試可以直接改 isPhone／isTablet 模擬手機或平板，
// 改過的測試要在結束時改回來（預設是電腦）。
export const Platform = {
	isDesktop: true,
	isDesktopApp: true,
	isMobile: false,
	isMobileApp: false,
	isPhone: false,
	isTablet: false,
};

export class ItemView {
	constructor(_leaf: unknown) {}
}

export class Scope {
	readonly bindings: Array<{ modifiers: string[]; key: string; callback: (event: KeyboardEvent) => boolean }> = [];
	constructor(_parent?: unknown) {}
	register(modifiers: string[], key: string, callback: (event: KeyboardEvent) => boolean): void {
		this.bindings.push({ modifiers, key, callback });
	}
}

// EventTarget keeps input/paste/change ordering testable without a real browser.
export class SettingsElement extends EventTarget {
	children: SettingsElement[] = [];
	classes = new Set<string>();
	attributes = new Map<string, string>();
	cssProps: Record<string, string> = {};
	dataset: Record<string, string> = {};
	tagName = '';
	textContent = '';
	value = '';
	placeholder = '';
	type = '';
	spellcheck = true;
	autocomplete = '';
	hidden = false;
	checked = false;
	disabled = false;
	selected = false;
	parentElement: SettingsElement | null = null;
	get classList(): { contains: (name: string) => boolean } { return { contains: (name) => this.classes.has(name) }; }

	createEl(tag: string, options: { cls?: string; text?: string; attr?: Record<string, string | number> } = {}): SettingsElement {
		const child = new SettingsElement();
		child.tagName = tag;
		child.parentElement = this;
		for (const cls of options.cls?.split(' ') ?? []) child.addClass(cls);
		for (const [name, value] of Object.entries(options.attr ?? {})) child.setAttribute(name, String(value));
		child.textContent = options.text ?? '';
		this.children.push(child);
		return child;
	}
	createDiv(options: { cls?: string; text?: string } = {}): SettingsElement { return this.createEl('div', options); }
	createSpan(options: { cls?: string; text?: string; attr?: Record<string, string | number> } = {}): SettingsElement {
		return this.createEl('span', options);
	}
	setCssProps(props: Record<string, string>): void { Object.assign(this.cssProps, props); }

	addClass(name: string): void { this.classes.add(name); }
	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
		if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
		if (name === 'value') this.value = value;
		if (name === 'type') this.type = value;
	}
	removeClass(name: string): void { this.classes.delete(name); }
	toggleClass(name: string, enabled: boolean): void {
		if (enabled) this.addClass(name);
		else this.removeClass(name);
	}
	setText(text: string): void { this.textContent = text; }
	appendText(text: string): void { this.textContent += text; }
	closest(selector: string): SettingsElement | null {
		if (selector.split(',').some((part) => this.classes.has(part.trim().slice(1)))) return this;
		return this.parentElement?.closest(selector) ?? null;
	}
	querySelector(selector: string): SettingsElement | null {
		for (const child of this.children) {
			if (selector === 'input[type="color"]' && child.type === 'color') return child;
			const found = child.querySelector(selector);
			if (found) return found;
		}
		return null;
	}
	empty(): void { this.children = []; }
	contains(child: SettingsElement): boolean {
		return child === this || this.children.some((entry) => entry.contains(child));
	}
}

export function setTooltip(el: SettingsElement, tooltip: string): void {
	el.setAttribute('data-tooltip', tooltip);
}

export class SettingsText {
	constructor(readonly inputEl: SettingsElement) {}
	setPlaceholder(value: string): this { this.inputEl.placeholder = value; return this; }
	setValue(value: string): this { this.inputEl.value = value; return this; }
	getValue(): string { return this.inputEl.value; }
	onChange(callback: (value: string) => void): this {
		this.inputEl.addEventListener('input', () => callback(this.getValue()));
		return this;
	}
	addOption(_value: string, _label: string): this { return this; }
}

class SettingsButton {
	label = '';
	icon = '';
	callback: () => void = () => {};
	setIcon(value: string): this { this.icon = value; return this; }
	setTooltip(value: string): this { this.label = value; return this; }
	setButtonText(value: string): this { this.label = value; return this; }
	setDisabled(_value: boolean): this { return this; }
	onClick(callback: () => void): this { this.callback = callback; return this; }
}

class SettingsToggle {
	setValue(_value: boolean): this { return this; }
	onChange(_callback: (value: boolean) => void): this { return this; }
}

export class Setting {
	static instances: Setting[] = [];
	settingEl: SettingsElement;
	controlEl: SettingsElement;
	descEl: SettingsElement;
	name = '';
	texts: SettingsText[] = [];
	buttons: SettingsButton[] = [];
	extraButtons: SettingsButton[] = [];
	colors: SettingsText[] = [];

	constructor(container: SettingsElement) {
		this.settingEl = container.createDiv();
		this.descEl = this.settingEl.createDiv();
		this.controlEl = this.settingEl.createDiv();
		Setting.instances.push(this);
	}

	setName(value: string): this { this.name = value; return this; }
	setDesc(value: string): this { this.descEl.textContent = value; return this; }
	setHeading(): this { return this; }
	addText(callback: (text: SettingsText) => void): this {
		const text = new SettingsText(this.controlEl.createDiv());
		this.texts.push(text);
		callback(text);
		return this;
	}
	addTextArea(callback: (text: SettingsText) => void): this { return this.addText(callback); }
	addDropdown(callback: (text: SettingsText) => void): this { return this.addText(callback); }
	addToggle(callback: (toggle: SettingsToggle) => void): this { callback(new SettingsToggle()); return this; }
	addColorPicker(callback: (color: SettingsText) => void): this {
		const input = this.controlEl.createDiv();
		input.type = 'color';
		const color = new SettingsText(input);
		this.colors.push(color);
		callback(color);
		return this;
	}
	addButton(callback: (button: SettingsButton) => void): this {
		const button = new SettingsButton();
		this.buttons.push(button);
		callback(button);
		return this;
	}
	addExtraButton(callback: (button: SettingsButton) => void): this {
		const button = new SettingsButton();
		this.extraButtons.push(button);
		callback(button);
		return this;
	}
}

export class PluginSettingTab {
	containerEl = new SettingsElement();
	constructor(readonly app: unknown, _plugin: unknown) {}
}
