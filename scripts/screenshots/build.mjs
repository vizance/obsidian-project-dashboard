import { build } from 'esbuild';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const dist = resolve(here, 'dist');
await mkdir(dist, { recursive: true });
const result = await build({
	absWorkingDir: root,
	entryPoints: [resolve(here, 'demo/main.ts')],
	outfile: resolve(dist, 'demo.js'),
	alias: { obsidian: resolve(here, 'shim/obsidian.ts') },
	bundle: true,
	platform: 'browser',
	format: 'iife',
	target: 'es2021',
	metafile: true,
	logLevel: 'info',
});
// Keep the module graph available for an offline check of the alias and isolation.
await writeFile(resolve(dist, 'meta.json'), JSON.stringify(result.metafile, null, 2) + '\n');
await Promise.all([
	copyFile(resolve(here, 'demo/index.html'), resolve(dist, 'index.html')),
	copyFile(resolve(here, 'demo/obsidian-base.css'), resolve(dist, 'obsidian-base.css')),
	copyFile(resolve(root, 'styles.css'), resolve(dist, 'styles.css')),
]);
