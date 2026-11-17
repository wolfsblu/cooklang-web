/**
 * Theme preference.
 *
 * The value can be `light`, `dark` or `system`. `system` follows the OS and is
 * also the fallback when nothing (or something unrecognised) is stored.
 *
 * The initial paint is handled by an inline script in `app.html` so the page
 * never flashes the wrong palette while the app hydrates. This module is what
 * the settings page uses afterwards. Keep the storage key and the accepted
 * values in step with that script.
 */

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'theme';

/** The palette currently painted, after resolving `system`. */
export type ResolvedTheme = Exclude<Theme, 'system'>;

export function isTheme(value: unknown): value is Theme {
	return value === 'light' || value === 'dark' || value === 'system';
}

/** Safe during SSR and in browsers that throw on localStorage access. */
export function getStoredTheme(): Theme {
	if (typeof localStorage === 'undefined') return 'system';

	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		return isTheme(stored) ? stored : 'system';
	} catch {
		return 'system';
	}
}

export function resolveTheme(theme: Theme): ResolvedTheme {
	if (theme !== 'system') return theme;
	if (typeof matchMedia === 'undefined') return 'light';
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the palette to the document. The token layer keys off `[data-theme]`. */
export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = resolveTheme(theme);
}

export function setTheme(theme: Theme): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// Private browsing and locked-down storage still get the change; it
		// just will not survive the next page load.
	}

	applyTheme(theme);
}
