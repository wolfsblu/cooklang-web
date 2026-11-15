<script lang="ts">
	import { ChevronDownIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * The integrated aisle picker used by the per-ingredient cards, the sticky
	 * bulk bars and the shopping list: the field owns the border and focus ring,
	 * the action sits inside its trailing edge, and the chevron is explicit
	 * because the native arrow would be hidden under that action.
	 */
	interface Props {
		categories: string[];
		label: string;
		/** Width/layout for the wrapper. */
		class?: string;
		/** `sm` fits dense rows such as the shopping list; `md` is the default. */
		size?: 'sm' | 'md';
		/** The submit action rendered inside the field's trailing edge. */
		action: Snippet;
	}

	const { categories, label, class: className, size = 'md', action }: Props = $props();
</script>

<div class="relative {size === 'sm' ? 'inline-block' : 'w-full'} {className ?? ''}">
	<select
		name="category"
		class="field appearance-none py-0 capitalize {size === 'sm'
			? 'h-8 w-auto pr-20 text-xs'
			: 'h-11 w-full pr-30 text-sm'}"
		aria-label={label}
	>
		{#each categories as category (category)}
			<option value={category}>{category}</option>
		{/each}
	</select>

	<ChevronDownIcon
		class={size === 'sm'
			? 'text-fg-subtle pointer-events-none absolute top-1/2 right-16 size-3.5 -translate-y-1/2'
			: 'text-fg-subtle pointer-events-none absolute top-1/2 right-[6.5rem] size-4 -translate-y-1/2'}
		aria-hidden="true"
	/>

	<div class="absolute top-1/2 right-1.5 -translate-y-1/2">
		{@render action()}
	</div>
</div>
