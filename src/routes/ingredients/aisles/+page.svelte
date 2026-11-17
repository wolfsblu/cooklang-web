<script lang="ts">
	import type { PageProps } from './$types';
	import AisleCategoryDialog from '#lib/components/aisles/AisleCategoryDialog.svelte';
	import AisleOrderCard from '#lib/components/aisles/AisleOrderCard.svelte';
	import Page from '#lib/components/ui/Page.svelte';
	import { countLabel } from '#lib/utils/pluralize.js';

	const { data }: PageProps = $props();

	let renameOpen = $state(false);
	let renaming = $state('');

	function openRename(name: string) {
		renaming = name;
		renameOpen = true;
	}
</script>

<svelte:head>
	<title>Aisles</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<header class="border-border flex shrink-0 items-center border-b px-4 py-3">
			<h1 class="text-fg text-base font-semibold">Aisles</h1>
		</header>

		<div class="min-h-0 flex-1 overflow-hidden">
			<AisleOrderCard categories={data.categories} counts={data.counts} onrename={openRename} />
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
		>
			<span class="tabular-nums">{countLabel(data.categories.length, 'aisle')}</span>
			<span class="text-border" aria-hidden="true">·</span>
			<span class="tabular-nums">{countLabel(data.total, 'ingredient')}</span>
		</footer>
	</div>
</Page>

<AisleCategoryDialog bind:open={renameOpen} original={renaming} />
