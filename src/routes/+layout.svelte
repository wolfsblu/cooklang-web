<script lang="ts">
	import { page } from '$app/state';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import AppHeader from '$lib/components/navigation/AppHeader.svelte';
	import NavigationBar from '$lib/components/navigation/NavigationBar.svelte';
	import SideRail from '$lib/components/navigation/SideRail.svelte';
	import type { LayoutProps } from './$types';

	const { children, data }: LayoutProps = $props();

	// Cook mode is full-bleed: no rail, header or tabs competing with the
	// recipe while someone is standing at a hob.
	const isCookMode = $derived(page.url.searchParams.has('cook'));

	// The editor is a workspace, not a document: it owns the remaining viewport
	// height so the code area and its bottom panel never make the page scroll.
	const isEditor = $derived(page.url.pathname.startsWith('/recipes/edit/'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isCookMode}
	<main class="h-dvh overflow-auto">
		{@render children()}
	</main>
{:else}
	<div class="flex {isEditor ? 'h-dvh overflow-hidden' : 'min-h-dvh'}">
		<SideRail shoppingCount={data.shoppingCount} />

		<div class="grid min-w-0 flex-1 grid-rows-[auto_1fr_auto] {isEditor ? 'h-dvh min-h-0' : ''}">
			<AppHeader />

			<main class="min-w-0 {isEditor ? 'min-h-0 overflow-hidden' : ''}">
				{@render children()}
			</main>

			<NavigationBar shoppingCount={data.shoppingCount} />
		</div>
	</div>
{/if}
