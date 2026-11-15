<script lang="ts">
	import type { Snippet } from 'svelte';
	import FieldWithAction from '#lib/components/ui/FieldWithAction.svelte';

	/**
	 * The integrated aisle picker used by the per-ingredient cards, the sticky
	 * bulk bars and the shopping list. The select *is* the field, so the whole
	 * control opens the picker, including the chevron that overlays its trailing
	 * edge. `bg-none` drops the chevron that `@tailwindcss/forms` paints into
	 * every select; ours is the one the user sees (and clicks).
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

	const {
		categories,
		label,
		class: className,
		size = 'md',
		action: actionSnippet
	}: Props = $props();
</script>

<FieldWithAction
	chevron={size}
	class="{size === 'sm' ? 'inline-block max-w-full' : 'w-full'} {className ?? ''}"
>
	<select
		name="category"
		class="field appearance-none bg-none capitalize {size === 'sm'
			? 'w-auto pr-24 text-xs'
			: 'w-full pr-32 text-sm'}"
		aria-label={label}
	>
		{#each categories as category (category)}
			<option value={category}>{category}</option>
		{/each}
	</select>

	{#snippet action()}
		{@render actionSnippet()}
	{/snippet}
</FieldWithAction>
