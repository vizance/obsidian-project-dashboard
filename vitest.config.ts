import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: `${import.meta.dirname}/tests/stubs/obsidian.ts`,
			// Tests must never read the real vault's rules; always use the neutral example.
			'./personal-rules.local': `${import.meta.dirname}/src/core/personal-rules.example.ts`,
		},
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		env: { TZ: 'Asia/Taipei' },
	},
});
