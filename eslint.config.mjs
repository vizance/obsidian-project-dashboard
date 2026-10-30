import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'coverage',
		'main.js',
		'manifest.json',
		'package-lock.json',
		'package.json',
		'versions.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.mjs',
						'esbuild.config.mjs',
						'scripts/deploy.mjs',
					],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['tests/**/*.ts'],
		rules: {
			'obsidianmd/no-forbidden-elements': 'off',
			'obsidianmd/no-nodejs-modules': 'off',
			'obsidianmd/prefer-create-el': 'off',
			'obsidianmd/prefer-window-timers': 'off',
		},
	},
	{
		files: ['scripts/**/*.mjs'],
		rules: {
			'obsidianmd/no-nodejs-modules': 'off',
			'obsidianmd/hardcoded-config-path': 'off',
			'obsidianmd/rule-custom-message': 'off',
		},
	},
);
