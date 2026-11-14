<script lang="ts">
	import { TimerIcon } from '@lucide/svelte';
	import { highlightClass } from '../highlight';

	interface Props {
		name: string | null;
		quantity: string | null;
		index?: number;
		cookMode?: boolean;
		active?: boolean;
		onstart?: (index: number, name: string, quantity: string) => void;
		/** Larger hit target for the single-step cook reading pane. */
		large?: boolean;
	}

	const {
		name,
		quantity,
		index = 0,
		cookMode = false,
		active = false,
		onstart,
		large = false
	}: Props = $props();

	function start() {
		if (cookMode && onstart && quantity) {
			onstart(index, name ?? 'Timer', quantity);
		}
	}
</script>

{#if cookMode}
	<button
		type="button"
		class="inline-flex cursor-pointer items-center rounded-sm transition-colors duration-150 {large
			? 'min-h-10 gap-1.5 px-2 py-0.5'
			: 'gap-1 px-1'} {active
			? highlightClass('timing')
			: 'bg-surface-muted text-fg-muted hover:bg-warn-soft hover:text-warn-soft-fg'}"
		onclick={start}
		aria-label="Start timer{name ? `: ${name}` : ''}{quantity ? ` for ${quantity}` : ''}"
	>
		<TimerIcon class={large ? 'size-4' : 'size-3'} />
		{#if name}<span class="font-medium">{name}:</span>{/if}
		{#if quantity}<span>{quantity}</span>{/if}
	</button>
{:else}
	<span class="text-fg-muted italic">
		{#if name}<span class="font-medium">{name}:</span>{/if}
		{#if quantity}<span>{quantity}</span>{/if}
	</span>
{/if}
