import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
	build: {
		target: 'esnext',
	},
	plugins: [
		wasm(),
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' })
	],
	ssr: {
		noExternal: ['@cooklang/cooklang']
	},
	optimizeDeps: {
		exclude: ['@cooklang/cooklang']
	}
});
