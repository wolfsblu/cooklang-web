<script lang="ts">
	import { CookingPotIcon } from '@lucide/svelte';
	import type { CookwareDisplay } from '$lib/types/recipe';
	import { highlightClass, resolveHighlight } from './highlight';

	interface Props {
		cookware: CookwareDisplay[];
		hoveredIndex: number | null;
		activeIndices: Set<number> | null;
		onhover: (index: number | null) => void;
		/** When false, the tab strip already names the pane; omit its heading. */
		header?: boolean;
	}

	const { cookware, hoveredIndex, activeIndices, onhover, header = true }: Props = $props();
</script>

{#snippet list()}
	<ul class="space-y-0.5 px-2 pb-2">
		{#each cookware as item (item.index)}
			{@const state = resolveHighlight({
				hovered: hoveredIndex === item.index,
				active: activeIndices?.has(item.index) ?? false
			})}
			<li
				class="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 transition-colors duration-150 {highlightClass(
					state
				)}"
				onmouseenter={() => onhover(item.index)}
				onmouseleave={() => onhover(null)}
			>
				<span class="min-w-0">
					<span class="font-medium">{item.name}</span>
					{#if item.note}
						<span class="text-fg-subtle text-sm italic"> ({item.note})</span>
					{/if}
				</span>
				{#if item.quantity}
					<span class="text-fg-muted shrink-0 text-right text-sm whitespace-nowrap tabular-nums">
						{item.quantity}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#if cookware.length > 0}
	{#if header}
		<section class="border-border border-b last:border-b-0">
			<h2 class="text-fg flex items-center gap-2 px-4 py-2 text-sm font-semibold">
				<CookingPotIcon class="text-accent2 size-4 shrink-0" />
				Cookware
				<span class="text-fg-subtle ml-auto text-xs font-normal tabular-nums">
					{cookware.length}
				</span>
			</h2>
			{@render list()}
		</section>
	{:else}
		<div class="pt-1">
			{@render list()}
		</div>
	{/if}
{/if}
