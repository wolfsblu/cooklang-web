import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	build: {
		target: 'esnext'
	},
	plugins: [
		tailwindcss(),
		// SvelteKit 3 takes its configuration through the plugin instead of a
		// svelte.config.js file.
		sveltekit({
			adapter: adapter()
		})
	],
	ssr: {
		noExternal: ['@cooklang/cooklang']
	},
	optimizeDeps: {
		exclude: ['@cooklang/cooklang']
	},
	test: {
		projects: [
			{
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.svelte.test.ts']
				}
			},
			{
				resolve: {
					conditions: ['browser']
				},
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.test.ts'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			}
		]
	}
});
