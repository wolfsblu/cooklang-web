<script lang="ts">
	import { CarrotIcon, CookingPotIcon, RefrigeratorIcon, SignpostIcon } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import type { SearchGroup, SearchGroupKey } from '$lib/types/search';
	import SearchResultRow from './SearchResultRow.svelte';

	/**
	 * The grouped result list, shared by the command-palette overlay and the
	 * full `/search` page. Group order is fixed by the server (recipes first),
	 * so results do not jump between categories as the score changes.
	 */
	interface Props {
		groups: SearchGroup[];
		query: string;
		/** Highlighted row, when the list is driven by keyboard selection. */
		activeId?: string | null;
		/** Every hit id in display order, used to address rows by position. */
		ids?: readonly string[];
		onhover?: (id: string) => void;
		/** True inside the overlay, where the list is a listbox. */
		combobox?: boolean;
		onnavigate?: () => void;
	}

	const {
		groups,
		query,
		activeId = null,
		ids = [],
		onhover,
		combobox = false,
		onnavigate
	}: Props = $props();

	const ICONS: Record<SearchGroupKey, Component<{ class?: string }>> = {
		recipes: CookingPotIcon,
		ingredients: CarrotIcon,
		aisles: SignpostIcon,
		pantry: RefrigeratorIcon
	};
</script>

<div>
	{#each groups as group (group.key)}
		{#if group.hits.length > 0}
			{@const Icon = ICONS[group.key]}
			<section role={combobox ? 'group' : undefined} aria-label={group.label}>
				<header
					class="text-fg-muted text-2xs flex items-center gap-2 px-2.5 pt-3 pb-1.5 font-semibold tracking-wider uppercase"
				>
					<Icon class="text-fg-subtle size-3.5" />
					<span>{group.label}</span>
					<span class="text-fg-subtle ml-auto tabular-nums">
						{group.hits.length < group.total
							? `${group.hits.length} of ${group.total}`
							: group.total}
					</span>
				</header>

				{#each group.hits as hit (hit.id)}
					{@const index = ids.indexOf(hit.id)}
					<SearchResultRow
						{hit}
						{query}
						active={activeId === hit.id}
						option={combobox}
						domId={index >= 0 ? `search-option-${index}` : undefined}
						onhover={onhover ? () => onhover(hit.id) : undefined}
						{onnavigate}
					/>
				{/each}
			</section>
		{/if}
	{/each}
</div>
