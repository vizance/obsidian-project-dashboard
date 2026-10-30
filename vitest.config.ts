import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: `${import.meta.dirname}/tests/stubs/obsidian.ts`,
		},
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		env: { TZ: 'Asia/Taipei' },
	},
});
