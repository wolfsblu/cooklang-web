<script lang="ts">
	import { ChevronDownIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * The integrated aisle picker used by both the per-ingredient cards and the
	 * sticky bulk bar: the field owns the border and focus ring, the action sits
	 * inside its trailing edge, and the chevron is explicit because the native
	 * arrow would be hidden under that action.
	 */
	interface Props {
		categories: string[];
		label: string;
		/** Width/layout for the wrapper; the field itself always fills it. */
		class?: string;
		/** The submit action rendered inside the field's trailing edge. */
		action: Snippet;
	}

	const { categories, label, class: className, action }: Props = $props();
</script>

<div class="relative w-full {className ?? ''}">
	<select
		name="category"
		class="field h-11 w-full appearance-none py-0 pr-30 text-sm capitalize"
		aria-label={label}
	>
		{#each categories as category (category)}
			<option value={category}>{category}</option>
		{/each}
	</select>

	<ChevronDownIcon
		class="text-fg-subtle pointer-events-none absolute top-1/2 right-[6.5rem] size-4 -translate-y-1/2"
		aria-hidden="true"
	/>

	<div class="absolute top-1/2 right-1.5 -translate-y-1/2">
		{@render action()}
	</div>
</div>
