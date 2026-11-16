// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Replaced at build time by vite.config.ts. Read them through
	// $lib/server/version instead of using them directly.
	const __APP_VERSION__: string;
	const __GIT_SHA__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
