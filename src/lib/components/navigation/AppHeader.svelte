<script lang="ts">
	import { onMount } from 'svelte';
	import { ChefHatIcon, MoonIcon, SearchIcon, SunIcon } from '@lucide/svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import SearchDialog from '$lib/components/search/SearchDialog.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';

	/**
	 * Sticky header with the brand, the global search trigger and the theme
	 * toggle.
	 *
	 * The trigger is a real link to `/search` so the feature works without
	 * JavaScript; the overlay is an enhancement layered on top of it. On
	 * desktop the link looks like the search field it used to be, because that
	 * is what people click, but it no longer navigates on every typed
	 * character: search is a command palette now.
	 */
	let searchOpen = $state(false);
	let shortcut = $state('Ctrl K');

	onMount(() => {
		if (/mac|iphone|ipad/i.test(navigator.userAgent)) shortcut = '⌘K';
	});

	function isEditable(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLElement &&
			target.matches('input, textarea, select, [contenteditable="true"]')
		);
	}

	function onKeydown(event: KeyboardEvent) {
		// Cmd/Ctrl+K is the palette shortcut everywhere it has become expected.
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			searchOpen = !searchOpen;
			return;
		}

		// "/" opens search the way it does almost everywhere else, but only
		// outside a field or the browser's own quick-find behaves unexpectedly.
		if (event.key === '/' && !searchOpen && !isEditable(event.target)) {
			event.preventDefault();
			searchOpen = true;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<header
	class="border-border bg-canvas/85 supports-[backdrop-filter]:bg-canvas/75 sticky top-0 z-30 border-b backdrop-blur-md"
>
	<div class="flex items-center gap-3 px-4 py-3 sm:px-6">
		<a href="/" class="flex items-center gap-2 md:hidden" aria-label="cooklang-web, go to recipes">
			<ChefHatIcon class="text-accent size-6" />
		</a>

		<a
			href="/search"
			onclick={(event) => {
				// Plain left-click opens the palette; modified clicks keep the
				// link's normal behaviour so a results page can be opened in a
				// new tab.
				if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
				event.preventDefault();
				searchOpen = true;
			}}
			class="border-border bg-surface text-fg-subtle hover:border-border-strong hover:text-fg-muted flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 text-sm transition-colors duration-150 sm:max-w-md"
			aria-label="Search recipes, ingredients, aisles and pantry"
		>
			<SearchIcon class="size-4 shrink-0" />
			<span class="min-w-0 flex-1 truncate text-left">Search…</span>
			<kbd
				class="border-border bg-surface-muted text-fg-subtle text-2xs hidden shrink-0 items-center rounded border px-1.5 py-0.5 font-medium sm:inline-flex"
			>
				{shortcut}
			</kbd>
		</a>

		<div class="ml-auto">
			<IconButton
				label={themeStore.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
				onclick={() => themeStore.toggle()}
			>
				{#if themeStore.isDark}
					<SunIcon class="size-4" />
				{:else}
					<MoonIcon class="size-4" />
				{/if}
			</IconButton>
		</div>
	</div>
</header>

<SearchDialog bind:open={searchOpen} />
