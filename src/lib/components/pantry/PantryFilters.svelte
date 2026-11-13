<script lang="ts" module>
	export type PantryFilter = 'all' | 'low' | 'expiring';
</script>

<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	/**
	 * The low-stock / expiring quick filters. Rendered twice: in the desktop
	 * filter row and inside the mobile toolbar, which scrolls sideways when the
	 * three labels and the folder actions do not fit.
	 */
	interface Props {
		filter: PantryFilter;
		lowCount: number;
		expiringCount: number;
		onchange: (filter: PantryFilter) => void;
	}

	let { filter, lowCount, expiringCount, onchange }: Props = $props();
</script>

<div class="flex shrink-0 items-center gap-2" role="group" aria-label="Filter pantry items">
	<Button
		variant={filter === 'all' ? 'primary' : 'ghost'}
		size="sm"
		class="whitespace-nowrap"
		onclick={() => onchange('all')}
	>
		All
	</Button>
	<Button
		variant={filter === 'low' ? 'primary' : 'ghost'}
		size="sm"
		class="whitespace-nowrap"
		onclick={() => onchange('low')}
	>
		Low stock
		{#if lowCount > 0}<Badge tone="warn">{lowCount}</Badge>{/if}
	</Button>
	<Button
		variant={filter === 'expiring' ? 'primary' : 'ghost'}
		size="sm"
		class="whitespace-nowrap"
		onclick={() => onchange('expiring')}
	>
		Expiring soon
		{#if expiringCount > 0}<Badge tone="warn">{expiringCount}</Badge>{/if}
	</Button>
</div>
