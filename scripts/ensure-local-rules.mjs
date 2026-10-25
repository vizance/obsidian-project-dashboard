import { existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'src', 'core');
const local = path.join(dir, 'personal-rules.local.ts');
const example = path.join(dir, 'personal-rules.example.ts');

if (!existsSync(local)) {
	copyFileSync(example, local);
	console.log('已建立 src/core/personal-rules.local.ts（複製自 personal-rules.example.ts，請自行編輯）');
}
