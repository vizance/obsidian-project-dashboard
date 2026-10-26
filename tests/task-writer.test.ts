import { describe, expect, it } from 'vitest';
import { TFile, Vault } from './stubs/obsidian';
import { TaskWriter } from '../src/task-writer';

const PATH = 'Projects/🚧 P-測試.md';

function setupVault(content: string): Vault {
	const vault = new Vault();
	const file = new TFile(PATH);
	vault.setAbstractFile(file);
	vault.setFileContent(PATH, content);
	return vault;
}

describe('TaskWriter.apply', () => {
	it('toggles an open task to done and stamps today', async () => {
		const vault = setupVault('- [ ] 確認拍攝服裝 📅 2026-10-30');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'toggle',
			path: PATH,
			line: 0,
			raw: '- [ ] 確認拍攝服裝 📅 2026-10-30',
			today: '2026-10-28',
		});
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH)).toBe('- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28');
	});

	it('shifts an open task by +7 days', async () => {
		const vault = setupVault('- [ ] A 📅 2026-10-30');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'shift',
			path: PATH,
			line: 0,
			raw: '- [ ] A 📅 2026-10-30',
			days: 7,
		});
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH)).toBe('- [ ] A 📅 2026-11-06');
	});

	it('schedules an unscheduled task', async () => {
		const vault = setupVault('- [ ] 製作學習日曆');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'schedule',
			path: PATH,
			line: 0,
			raw: '- [ ] 製作學習日曆',
			date: '2026-11-06',
		});
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH)).toBe('- [ ] 製作學習日曆 📅 2026-11-06');
	});

	it('adds a new task after the last checkbox task line', async () => {
		const content = ['## 拍攝', '- [ ] 確認拍攝服裝 📅 2026-10-30', '- [x] 租借場地 ✅ 2026-10-26', '', '## 備註'].join(
			'\n',
		);
		const vault = setupVault(content);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'add', path: PATH, text: '寄出 邀請函', date: '2026-11-06' });
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH).split('\n')).toEqual([
			'## 拍攝',
			'- [ ] 確認拍攝服裝 📅 2026-10-30',
			'- [x] 租借場地 ✅ 2026-10-26',
			'- [ ] 寄出 邀請函 📅 2026-11-06',
			'',
			'## 備註',
		]);
	});

	it('rejects an empty add as invalid and leaves the note unchanged', async () => {
		const vault = setupVault('## 拍攝');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'add', path: PATH, text: '   ', date: '2026-11-06' });
		expect(result).toEqual({ status: 'invalid' });
		expect(vault.getFileContent(PATH)).toBe('## 拍攝');
	});

	// Spec scenarios record the task at line 12; filler lines keep every other
	// line distinct so "no other line changed" is a whole-file comparison.
	const filler = (n: number, tag: string): string[] => Array.from({ length: n }, (_, i) => `${tag} ${i}`);
	const RAW = '- [ ] 確認拍攝服裝 📅 2026-10-30';

	it('Line changed since the scan: rejects as stale and leaves the note unchanged', async () => {
		const content = [...filler(12, '前文'), '- [ ] 確認拍攝服裝與髮型 📅 2026-10-30', '後文'].join('\n');
		const vault = setupVault(content);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'shift', path: PATH, line: 12, raw: RAW, days: 7 });
		expect(result).toEqual({ status: 'stale' });
		expect(vault.getFileContent(PATH)).toBe(content);
	});

	it('Line moved down but unique: rewrites line 14 and no other line', async () => {
		const before = [...filler(12, '前文'), '新增 A', '新增 B', RAW, '後文'];
		const vault = setupVault(before.join('\n'));
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'toggle', path: PATH, line: 12, raw: RAW, today: '2026-10-28' });
		expect(result).toEqual({ status: 'ok' });
		const after = before.slice();
		after[14] = '- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28';
		expect(vault.getFileContent(PATH)).toBe(after.join('\n'));
	});

	it('Ambiguous duplicate is rejected: leaves the note unchanged', async () => {
		const content = [...filler(12, '前文'), '已經改掉的那一行', RAW, '中間', RAW].join('\n');
		const vault = setupVault(content);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'shift', path: PATH, line: 12, raw: RAW, days: 7 });
		expect(result).toEqual({ status: 'stale' });
		expect(vault.getFileContent(PATH)).toBe(content);
	});

	it('rejects shifting a done line as invalid and leaves the note unchanged', async () => {
		const content = '- [x] 確認拍攝服裝 📅 2026-10-30 ✅ 2026-10-28';
		const vault = setupVault(content);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'shift',
			path: PATH,
			line: 0,
			raw: content,
			days: 7,
		});
		expect(result).toEqual({ status: 'invalid' });
		expect(vault.getFileContent(PATH)).toBe(content);
	});

	it('returns missing-file when the path has no file', async () => {
		const vault = setupVault('- [ ] A 📅 2026-10-30');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'toggle',
			path: 'Projects/does-not-exist.md',
			line: 0,
			raw: '- [ ] A 📅 2026-10-30',
			today: '2026-10-28',
		});
		expect(result).toEqual({ status: 'missing-file' });
	});

	it('preserves \\r\\n line terminators', async () => {
		const vault = setupVault('- [ ] A 📅 2026-10-30\r\n- [ ] B\r\n');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'toggle',
			path: PATH,
			line: 0,
			raw: '- [ ] A 📅 2026-10-30',
			today: '2026-10-28',
		});
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH)).toBe('- [x] A 📅 2026-10-30 ✅ 2026-10-28\r\n- [ ] B\r\n');
	});

	it('preserves a missing trailing terminator', async () => {
		const vault = setupVault('- [ ] A 📅 2026-10-30');
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'shift',
			path: PATH,
			line: 0,
			raw: '- [ ] A 📅 2026-10-30',
			days: 7,
		});
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH)).toBe('- [ ] A 📅 2026-11-06');
	});

	it('rejects toggling a recurring task as invalid and leaves the note unchanged', async () => {
		const content = '- [ ] 週報 🔁 every week 📅 2026-10-30\n';
		const vault = setupVault(content);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({
			kind: 'toggle',
			path: PATH,
			line: 0,
			raw: '- [ ] 週報 🔁 every week 📅 2026-10-30',
			today: '2026-10-28',
		});
		expect(result).toEqual({ status: 'invalid' });
		expect(vault.getFileContent(PATH)).toBe(content);
	});

	// 規格 "Example: end-of-note insertion"（week 2026-W45, text `寄出 邀請函`）。
	describe('end-of-note insertion', () => {
		const NEW_LINE = '- [ ] 寄出 邀請函 📅 2026-11-06';

		it.each([
			['## 備註\n', `## 備註\n${NEW_LINE}\n`],
			['## 備註', `## 備註\n${NEW_LINE}`],
			['', NEW_LINE],
			['- [ ] A\n```md\n- [ ] 範例\n```\n', `- [ ] A\n${NEW_LINE}\n\`\`\`md\n- [ ] 範例\n\`\`\`\n`],
		])('%j -> %j', async (before, after) => {
			const vault = setupVault(before);
			const writer = new TaskWriter(vault);
			const result = await writer.apply({ kind: 'add', path: PATH, text: '寄出 邀請函', date: '2026-11-06' });
			expect(result).toEqual({ status: 'ok' });
			expect(vault.getFileContent(PATH)).toBe(after);
		});
	});

	// 規格 "Example: line terminators preserved"。
	describe('line terminators preserved', () => {
		it('toggle line 0 keeps both \\r\\n terminators', async () => {
			const vault = setupVault('- [ ] A 📅 2026-10-30\r\n- [ ] B\r\n');
			const writer = new TaskWriter(vault);
			const result = await writer.apply({
				kind: 'toggle',
				path: PATH,
				line: 0,
				raw: '- [ ] A 📅 2026-10-30',
				today: '2026-10-28',
			});
			expect(result).toEqual({ status: 'ok' });
			expect(vault.getFileContent(PATH)).toBe('- [x] A 📅 2026-10-30 ✅ 2026-10-28\r\n- [ ] B\r\n');
		});

		it('shift line 0 of a note without a trailing terminator', async () => {
			const vault = setupVault('- [ ] A 📅 2026-10-30');
			const writer = new TaskWriter(vault);
			const result = await writer.apply({ kind: 'shift', path: PATH, line: 0, raw: '- [ ] A 📅 2026-10-30', days: 7 });
			expect(result).toEqual({ status: 'ok' });
			expect(vault.getFileContent(PATH)).toBe('- [ ] A 📅 2026-11-06');
		});

		it('shift line 1 keeps the mixed \\r\\n and \\n terminators', async () => {
			const vault = setupVault('## h\r\n- [ ] A 📅 2026-10-30\n- [ ] B 📅 2026-10-31\n');
			const writer = new TaskWriter(vault);
			const result = await writer.apply({ kind: 'shift', path: PATH, line: 1, raw: '- [ ] A 📅 2026-10-30', days: 7 });
			expect(result).toEqual({ status: 'ok' });
			expect(vault.getFileContent(PATH)).toBe('## h\r\n- [ ] A 📅 2026-11-06\n- [ ] B 📅 2026-10-31\n');
		});

		it('add takes the terminator of the line before it', async () => {
			const vault = setupVault('## h\n- [ ] A\r\n- [ ] B\n');
			const writer = new TaskWriter(vault);
			const result = await writer.apply({ kind: 'add', path: PATH, text: 'new', date: '2026-11-06' });
			expect(result).toEqual({ status: 'ok' });
			expect(vault.getFileContent(PATH)).toBe('## h\n- [ ] A\r\n- [ ] B\n- [ ] new 📅 2026-11-06\n');
		});
	});

	describe('code-fence and frontmatter lines are never written', () => {
		it('rejects toggling a checkbox line inside a code fence as invalid', async () => {
			const content = '```md\n- [ ] 範例待辦\n```\n';
			const vault = setupVault(content);
			const writer = new TaskWriter(vault);
			const result = await writer.apply({
				kind: 'toggle',
				path: PATH,
				line: 1,
				raw: '- [ ] 範例待辦',
				today: '2026-10-28',
			});
			expect(result).toEqual({ status: 'invalid' });
			expect(vault.getFileContent(PATH)).toBe(content);
		});

		it('rejects scheduling a checkbox line inside the frontmatter as invalid', async () => {
			const content = '---\n- [ ] 不是任務\n---\n';
			const vault = setupVault(content);
			const writer = new TaskWriter(vault);
			const result = await writer.apply({
				kind: 'schedule',
				path: PATH,
				line: 1,
				raw: '- [ ] 不是任務',
				date: '2026-11-06',
			});
			expect(result).toEqual({ status: 'invalid' });
			expect(vault.getFileContent(PATH)).toBe(content);
		});

		it('rejects scheduling a line whose date marker is a variant as invalid', async () => {
			const content = '- [ ] 任務 📅️ 2026-11-06';
			const vault = setupVault(content);
			const writer = new TaskWriter(vault);
			const result = await writer.apply({ kind: 'schedule', path: PATH, line: 0, raw: content, date: '2026-11-06' });
			expect(result).toEqual({ status: 'invalid' });
			expect(vault.getFileContent(PATH)).toBe(content);
		});
	});

	it('re-throws a real read/write failure instead of reporting ok', async () => {
		const vault = setupVault('- [ ] A 📅 2026-10-30');
		vault.process = () => Promise.reject(new Error('disk full'));
		const writer = new TaskWriter(vault);
		await expect(
			writer.apply({ kind: 'shift', path: PATH, line: 0, raw: '- [ ] A 📅 2026-10-30', days: 7 }),
		).rejects.toThrow('disk full');
	});

	it('rejects an edit whose rewrite would leave the line unchanged as invalid', async () => {
		// U+2028 is not a line break for the scanner, but the toggle rewrite cannot
		// span it, so the rewrite is a no-op; reporting ok would leave the popover
		// waiting for a re-render that never comes.
		const content = '- [ ] A\u2028B 📅 2026-10-30';
		const vault = setupVault(content);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'toggle', path: PATH, line: 0, raw: content, today: '2026-10-28' });
		expect(result).toEqual({ status: 'invalid' });
		expect(vault.getFileContent(PATH)).toBe(content);
	});

	it('schedules a line whose only ✅ is inside a link', async () => {
		const raw = '- [ ] 追蹤後續 [[✅ P-2026 範例：已完成專案]]';
		const vault = setupVault(raw);
		const writer = new TaskWriter(vault);
		const result = await writer.apply({ kind: 'schedule', path: PATH, line: 0, raw, date: '2026-11-06' });
		expect(result).toEqual({ status: 'ok' });
		expect(vault.getFileContent(PATH)).toBe(`${raw} 📅 2026-11-06`);
	});
});
