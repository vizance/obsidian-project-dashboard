import { TFile } from 'obsidian';
import {
	buildNewTaskLine,
	hasDateLikeMarker,
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

const TERMINATOR_RE = /(\r\n|\r|\n)/;
const DEFAULT_TERMINATOR = '\n';

// 切法與掃描器（parseTaskLines）完全相同，所以記下來的行號對得上；但每一行自己
// 的換行字元要留著，混用 \r\n 與 \n 的筆記才不會被整篇改成同一種換行。
// 偶數位置是行，奇數位置是那一行後面的換行字元；最後一個一定是行。
function splitPieces(content: string): string[] {
	return content.split(TERMINATOR_RE);
}

function linesOf(pieces: string[]): string[] {
	return pieces.filter((_, i) => i % 2 === 0);
}

// 新行的換行字元沿用前一行的（前一行沒有就用筆記的第一個，再沒有就用 \n）。
function terminatorFor(pieces: string[], at: number): string {
	return (at > 0 ? pieces[2 * at - 1] : undefined) ?? pieces[1] ?? DEFAULT_TERMINATOR;
}

function insertLine(pieces: string[], index: number, line: string): void {
	// 空筆記整則就是這一行，不要多長出一個結尾換行。
	if (pieces.length === 1 && pieces[0] === '') {
		pieces[0] = line;
		return;
	}
	// 筆記以換行結尾時，最後一個「行」是結尾換行後面的空字串：新行插在它前面，
	// 結尾換行就留下來了。沒有結尾換行時改成接上換行 + 新行，結尾一樣沒有換行。
	const endsWithTerminator = pieces[pieces.length - 1] === '';
	const count = (pieces.length + 1) / 2;
	const at = Math.min(index, endsWithTerminator ? count - 1 : count);
	const terminator = terminatorFor(pieces, at);
	if (at >= count) {
		pieces.push(terminator, line);
		return;
	}
	pieces.splice(2 * at, 0, line, terminator);
}

export class TaskWriter {
	constructor(private readonly vault: TaskWriterVault) {}

	async apply(edit: TaskEdit): Promise<TaskWriterResult> {
		const file = this.vault.getAbstractFileByPath(edit.path);
		if (!(file instanceof TFile)) return { status: 'missing-file' };

		let result: TaskWriterResult['status'] = 'ok';
		try {
			await this.vault.process(file, (content) => {
				const pieces = splitPieces(content);
				const lines = linesOf(pieces);

				if (edit.kind === 'add') {
					const newLine = buildNewTaskLine(edit.text, edit.date);
					if (newLine === null) {
						result = 'invalid';
						throw new Error('invalid');
					}
					insertLine(pieces, newTaskInsertIndex(lines), newLine);
					return pieces.join('');
				}

				const idx = locateLine(lines, edit.line, edit.raw);
				if (idx === -1) {
					result = 'stale';
					throw new Error('stale');
				}

				const current = lines[idx]!;
				// 整則筆記一起解析，前置條件才知道這一行是不是落在程式碼圍欄或
				// frontmatter 裡 — 那裡的核取方塊不是任務，永遠不能被改寫。
				const analyzed = parseTaskLines(content).find((l) => l.line === idx);
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
					// 與 unscheduledTasks 同一條規則：行裡有像日期標記的東西就不再排日期，
					// 解析不出來的變形標記也算。
					if (!analyzed || !analyzed.checkbox || analyzed.done || hasDateLikeMarker(current)) {
						result = 'invalid';
						throw new Error('invalid');
					}
					rewritten = scheduleLine(current, edit.date);
				}

				// 改寫後跟原本一樣代表這一行的格式超出改寫規則能處理的範圍；回報 ok 會讓
				// 畫面一直等一個不會來的重繪，所以當成 invalid 拒絕。
				if (rewritten === current) {
					result = 'invalid';
					throw new Error('invalid');
				}
				pieces[2 * idx] = rewritten;
				return pieces.join('');
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
