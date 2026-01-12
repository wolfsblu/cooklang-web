<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		position?: 'left' | 'right';
		onclose: () => void;
		headerActions?: Snippet;
		children: Snippet;
		footer?: Snippet;
	};

	const { title, position = 'left', onclose, headerActions, children, footer }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	const borderClass = position === 'left' ? 'border-r' : 'border-l';
</script>

<svelte:window onkeydown={handleKeydown} />

<aside
	class="w-80 max-w-full bg-surface-100-900 {borderClass} border-surface-200-800 shadow-xl flex flex-col h-full"
>
	<!-- Header -->
	<header class="flex items-center justify-between p-4 border-b border-surface-200-800">
		<h2 class="h5">{title}</h2>
		<div class="flex items-center gap-2">
			{#if headerActions}
				{@render headerActions()}
			{/if}
			<button
				type="button"
				onclick={onclose}
				class="btn btn-sm preset-tonal-surface"
				aria-label="Close panel"
			>
				<X class="size-4" />
			</button>
		</div>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4 space-y-3">
		{@render children()}
	</div>

	<!-- Footer -->
	{#if footer}
		<footer class="p-4 border-t border-surface-200-800">
			{@render footer()}
		</footer>
	{/if}
</aside>
