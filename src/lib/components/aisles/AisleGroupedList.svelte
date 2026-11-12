<script lang="ts">
	import type { AisleEntryView } from '../../../routes/aisles/ingredients/+page.server';
	import AisleEntryTable from './AisleEntryTable.svelte';

	interface Props {
		entries: AisleEntryView[];
		/** Aisles in file order, which is the order they group in. */
		categories: string[];
		onedit: (entry: AisleEntryView) => void;
	}

	const { entries, categories, onedit }: Props = $props();

	const byCategory = $derived.by(() => {
		const map: Record<string, AisleEntryView[]> = {};
		for (const category of categories) map[category] = [];
		for (const entry of entries) (map[entry.category] ??= []).push(entry);
		return map;
	});

	function href(category: string): string {
		return `/aisles/ingredients?category=${encodeURIComponent(category)}`;
	}
</script>

<!-- Groups are sections of the single workbench pane, separated by hairlines
     rather than each sitting in its own card. -->
<div class="min-h-0 flex-1 overflow-y-auto">
	{#each categories as category (category)}
		{@const group = byCategory[category] ?? []}
		<section class="border-border border-t first:border-t-0">
			<header class="flex items-baseline justify-between gap-3 px-4 py-2">
				<h3 class="text-fg text-sm font-semibold">
					<a href={href(category)} class="capitalize hover:underline">{category}</a>
					<span class="text-fg-subtle ml-1 text-xs font-normal tabular-nums">{group.length}</span>
				</h3>
			</header>

			{#if group.length > 0}
				<div class="px-4">
					<AisleEntryTable entries={group} showCategory={false} {onedit} />
				</div>
			{:else}
				<p class="text-fg-subtle px-4 pb-3 text-sm">
					Nothing here yet — assign ingredients from the
					<a href="/aisles/unassigned" class="link">Unassigned</a> tab.
				</p>
			{/if}
		</section>
	{/each}
</div>
