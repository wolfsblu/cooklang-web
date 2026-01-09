<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
    import NavigationBar from '$lib/components/navigation/NavigationBar.svelte';
	import { modeStore } from '$lib/stores/theme.svelte';

	let { children } = $props();

	// Initialize mode (accessing the store ensures it's initialized)
	$effect(() => {
		modeStore.current;
	});

	// Check if we're in cook mode
	const isCookMode = $derived(page.url.searchParams.has('cook'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<script>
		const mode = localStorage.getItem('mode') || 'light';
		document.documentElement.setAttribute('data-mode', mode);
		document.documentElement.style.colorScheme = mode;
	</script>
</svelte:head>

<div class="min-h-screen {isCookMode ? '' : 'pb-20'}">
	<main>
		{@render children()}
	</main>
</div>
{#if !isCookMode}
	<div class="fixed bottom-0 left-0 right-0 z-50">
		<NavigationBar />
	</div>
{/if}
