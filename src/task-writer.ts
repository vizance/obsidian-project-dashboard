import { TFile } from 'obsidian';
import {
	buildNewTaskLine,
	locateLine,
	newTaskInsertIndex,
	parseTaskLines,
	scheduleLine,
	shiftDueLine,
	toggleDoneLine,
} from './core/task-lines';

// One edit per popover action. `line`/`raw` identify the target line as recorded
// at scan time so the writer can re-locate and re-validate it before writing
// (design.md: 單一寫入模組與寫入前比對). `add` has no target line — it only
// carries the text to insert and the date to stamp it with.
export type TaskEdit =
	| { kind: 'toggle'; path: string; line: number; raw: string; today: string }
	| { kind: 'shift'; path: string; line: number; raw: string; days: number }
	| { kind: 'schedule'; path: string; line: number; raw: string; date: string }
	| { kind: 'add'; path: string; text: string; date: string };

export type TaskWriterResult = { status: 'ok' | 'stale' | 'invalid' | 'missing-file' };

interface PathedFile {
	path: string;
}

// Narrow slice of Obsidian's Vault that TaskWriter needs, so a minimal test
// stub can satisfy it the same way src/vault-source.ts's VaultLike does.
export interface TaskWriterVault {
	getAbstractFileByPath(path: string): PathedFile | null;
	process(file: TFile, fn: (data: string) => string): Promise<string>;
}

function detectTerminator(content: string): '\r\n' | '\n' {
	return content.includes('\r\n') ? '\r\n' : '\n';
}

function splitContent(content: string): { lines: string[]; terminator: '\r\n' | '\n'; trailing: boolean } {
	const terminator = detectTerminator(content);
	const trailing = content.endsWith(terminator);
	const body = trailing ? content.slice(0, -terminator.length) : content;
	return { lines: body.split(terminator), terminator, trailing };
}

function joinContent(lines: string[], terminator: '\r\n' | '\n', trailing: boolean): string {
	return lines.join(terminator) + (trailing ? terminator : '');
}

export class TaskWriter {
	constructor(private readonly vault: TaskWriterVault) {}

	async apply(edit: TaskEdit): Promise<TaskWriterResult> {
		const file = this.vault.getAbstractFileByPath(edit.path);
		if (!(file instanceof TFile)) return { status: 'missing-file' };

		let result: TaskWriterResult['status'] = 'ok';
		try {
			await this.vault.process(file, (content) => {
				const { lines, terminator, trailing } = splitContent(content);

				if (edit.kind === 'add') {
					const newLine = buildNewTaskLine(edit.text, edit.date);
					if (newLine === null) {
						result = 'invalid';
						throw new Error('invalid');
					}
					lines.splice(newTaskInsertIndex(lines), 0, newLine);
					return joinContent(lines, terminator, trailing);
				}

				const idx = locateLine(lines, edit.line, edit.raw);
				if (idx === -1) {
					result = 'stale';
					throw new Error('stale');
				}

				const current = lines[idx]!;
				const analyzed = parseTaskLines(current)[0];
				let rewritten: string;

				if (edit.kind === 'toggle') {
					if (!analyzed || !analyzed.checkbox || analyzed.recurring) {
						result = 'invalid';
						throw new Error('invalid');
					}
					rewritten = toggleDoneLine(current, edit.today);
				} else if (edit.kind === 'shift') {
					if (!analyzed || !analyzed.checkbox || analyzed.done || analyzed.due === null) {
						result = 'invalid';
						throw new Error('invalid');
					}
					rewritten = shiftDueLine(current, edit.days);
				} else {
					if (!analyzed || !analyzed.checkbox || analyzed.done || analyzed.dates.length > 0) {
						result = 'invalid';
						throw new Error('invalid');
					}
					rewritten = scheduleLine(current, edit.date);
				}

				lines[idx] = rewritten;
				return joinContent(lines, terminator, trailing);
			});
		} catch (err) {
			// A stale/invalid rejection was recorded before the throw, and
			// Vault.process leaves the stored content untouched on a throw. Any
			// other error is a real read/write failure: re-throw it so the caller
			// shows a message instead of treating it as a successful edit.
			if (result === 'ok') throw err;
		}
		return { status: result };
	}
}
