import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
	version: string;
};

export default defineConfig({
	build: {
		target: 'esnext'
	},
	define: {
		// Docker passes the release version and commit at build time. The
		// package.json fallback keeps local builds and `npm run dev` sensible.
		__APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
		__GIT_SHA__: JSON.stringify(process.env.GIT_SHA ?? 'dev')
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
