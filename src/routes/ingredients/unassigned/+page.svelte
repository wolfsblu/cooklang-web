<script lang="ts">
	import type { PageProps } from './$types';
	import AisleUnassignedList from '#lib/components/aisles/AisleUnassignedList.svelte';
	import Page from '#lib/components/ui/Page.svelte';
	import { countLabel } from '#lib/utils/pluralize.js';

	const { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Unassigned ingredients</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<header class="border-border flex shrink-0 items-center border-b px-4 py-3">
			<h1 class="text-fg text-base font-semibold">Unassigned</h1>
		</header>

		<div class="flex min-h-0 flex-1 flex-col">
			<AisleUnassignedList items={data.unassigned} categories={data.categories} />
		</div>

		<footer
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-1.5 text-xs"
		>
			<span class="tabular-nums">{countLabel(data.unassigned.length, 'ingredient')} unassigned</span
			>
		</footer>
	</div>
</Page>
