<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
    import NavigationBar from '$lib/components/navigation/NavigationBar.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="h-screen max-h-screen flex flex-col justify-between">
	<main class="grow overflow-y-auto p-3">
		{@render children()}
	</main>
	<NavigationBar />
</div>
