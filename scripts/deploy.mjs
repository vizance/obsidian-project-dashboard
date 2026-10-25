import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PLUGIN_ID = 'project-dashboard';
const FILES = ['main.js', 'manifest.json', 'styles.css'];
const LOCAL_CONFIG = path.join(process.cwd(), 'deploy.local.json');

function resolveVault() {
	if (process.env.OBSIDIAN_VAULT) return process.env.OBSIDIAN_VAULT;
	if (existsSync(LOCAL_CONFIG)) {
		const config = JSON.parse(readFileSync(LOCAL_CONFIG, 'utf8'));
		if (config.vault) return config.vault;
	}
	console.error(
		'找不到 Obsidian vault 路徑。請設定環境變數 OBSIDIAN_VAULT，或在專案根目錄建立 deploy.local.json：{ "vault": "/path/to/vault" }\n' +
			'No Obsidian vault path found. Set the OBSIDIAN_VAULT environment variable, or create deploy.local.json in the project root: { "vault": "/path/to/vault" }',
	);
	process.exit(1);
}

const vault = resolveVault();
const obsidianDir = path.join(vault, '.obsidian');

execSync('npm run build', { stdio: 'inherit' });

if (!existsSync(obsidianDir)) {
	console.error(`找不到 .obsidian 資料夾：${obsidianDir}`);
	process.exit(1);
}

const pluginDir = path.join(obsidianDir, 'plugins', PLUGIN_ID);
mkdirSync(pluginDir, { recursive: true });

for (const file of FILES) {
	copyFileSync(path.join(process.cwd(), file), path.join(pluginDir, file));
}

console.log(`已部署到 ${pluginDir}`);
