<script lang="ts">
	import { CarrotIcon, CookingPotIcon } from '@lucide/svelte';
	import type { CompletionKind, CompletionTerm } from '$lib/types/editor';

	interface Props {
		items: CompletionTerm[];
		activeIndex: number;
		kind: CompletionKind;
		position: { left: number; top: number; width: number };
		onselect: (term: CompletionTerm) => void;
		onhover: (index: number) => void;
	}

	const { items, activeIndex, kind, position, onselect, onhover }: Props = $props();

	const title = $derived(kind === 'ingredient' ? 'Ingredients' : 'Cookware');
	const emptyHint = $derived(kind === 'ingredient' ? '@ingredient' : '#cookware');
</script>

<!--
	A fixed-position list rather than a popover anchored in the document flow:
	the textarea scrolls its own contents, so the caret's viewport coordinates
	are the only position that stays correct at every scroll offset.
-->
<div
	id="completion-menu"
	class="border-border bg-surface shadow-pop fixed z-50 overflow-hidden rounded-lg border"
	style:left="{position.left}px"
	style:top="{position.top}px"
	style:width="{position.width}px"
	role="listbox"
	aria-label="{title} suggestions"
>
	<div
		class="border-border text-fg-subtle flex items-center justify-between border-b px-2.5 py-1.5"
	>
		<span class="text-2xs font-semibold tracking-wide uppercase">{title}</span>
		<span class="text-2xs">↑↓ · Enter</span>
	</div>

	{#if items.length === 0}
		<p class="text-fg-subtle px-3 py-3 text-sm">
			No match. Type <code class="text-fg">{emptyHint}&#123;&#125;</code> to add a new one.
		</p>
	{:else}
		<ul class="max-h-64 overflow-y-auto py-1">
			{#each items as item, index (item.name)}
				<li>
					<button
						type="button"
						role="option"
						tabindex="-1"
						id="completion-option-{index}"
						aria-selected={index === activeIndex}
						class="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors duration-100 {index ===
						activeIndex
							? 'bg-accent-soft text-accent-soft-fg'
							: 'text-fg hover:bg-surface-muted'}"
						onmousedown={(event) => event.preventDefault()}
						onclick={() => onselect(item)}
						onmouseenter={() => onhover(index)}
					>
						{#if kind === 'ingredient'}
							<CarrotIcon class="text-accent size-3.5 shrink-0" />
						{:else}
							<CookingPotIcon class="text-accent2 size-3.5 shrink-0" />
						{/if}
						<span class="min-w-0 flex-1 truncate text-sm">{item.name}</span>
						{#if item.count > 1}
							<span class="text-fg-subtle text-2xs tabular-nums">{item.count}×</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
