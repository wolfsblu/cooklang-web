<script lang="ts">
	import { CookingPotIcon, CarrotIcon, RefrigeratorIcon, SignpostIcon } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import type { SearchGroupKey, SearchHit } from '$lib/types/search';
	import Highlight from './Highlight.svelte';

	/**
	 * One row in the grouped result list.
	 *
	 * It stays an anchor in both presentations so middle-click, copy-link and
	 * no-JS behaviour are free; the combobox wiring is layered on as roles and
	 * ids rather than replacing the link.
	 */
	interface Props {
		hit: SearchHit;
		query: string;
		active?: boolean;
		/** True inside the overlay, where rows are options in a listbox. */
		option?: boolean;
		domId?: string;
		onhover?: () => void;
		onnavigate?: () => void;
	}

	const {
		hit,
		query,
		active = false,
		option = false,
		domId,
		onhover,
		onnavigate
	}: Props = $props();

	const ICONS: Record<SearchGroupKey, Component<{ class?: string }>> = {
		recipes: CookingPotIcon,
		ingredients: CarrotIcon,
		aisles: SignpostIcon,
		pantry: RefrigeratorIcon
	};

	const Icon = $derived(ICONS[hit.group]);
</script>

<a
	href={hit.href}
	id={domId}
	role={option ? 'option' : undefined}
	aria-selected={option ? active : undefined}
	onmouseenter={onhover}
	onclick={onnavigate}
	tabindex={option ? -1 : undefined}
	class="group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors duration-100 {active
		? 'bg-accent-soft'
		: 'hover:bg-surface-muted'}"
>
	{#if hit.image}
		<img
			src={hit.image.src}
			srcset={hit.image.srcset}
			width={hit.image.width}
			height={hit.image.height}
			alt=""
			loading="lazy"
			decoding="async"
			class="border-border bg-surface-muted size-9 shrink-0 rounded border object-cover"
		/>
	{:else}
		<span
			class="border-border bg-surface-muted text-fg-subtle flex size-9 shrink-0 items-center justify-center rounded border"
		>
			<Icon class="size-4" />
		</span>
	{/if}

	<span class="min-w-0 flex-1">
		<span class="text-fg block truncate text-sm font-medium">
			<Highlight text={hit.title} {query} />
		</span>
		{#if hit.subtitle}
			<span class="text-fg-subtle block truncate text-xs">
				<Highlight text={hit.subtitle} {query} />
			</span>
		{/if}
	</span>

	{#if hit.meta.length > 0}
		<span class="text-fg-subtle hidden shrink-0 text-xs tabular-nums sm:block">
			{hit.meta.join(' · ')}
		</span>
	{/if}
</a>
