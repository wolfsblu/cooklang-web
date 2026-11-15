<script lang="ts">
	import { ChevronDownIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * A form field with its submit action embedded in the trailing edge.
	 *
	 * The control is passed as the default snippet and keeps the global `.field`
	 * styling; it reserves the action's space with right padding. The action
	 * floats above it in a group inset from the field's edge, so the button's
	 * height follows the control instead of a fixed size.
	 *
	 * The group is pointer-transparent: clicks on the chevron fall through to
	 * the select underneath, while the action re-enables its own pointer events.
	 */
	interface Props {
		/** The control: an input, or a select when `chevron` is set. */
		children: Snippet;
		action: Snippet;
		/** Show a chevron before the action, sized for the field. */
		chevron?: 'sm' | 'md';
		/** Layout for the positioning wrapper. */
		class?: string;
	}

	const { children, action, chevron, class: className }: Props = $props();
</script>

<div class="relative {className ?? ''}">
	{@render children()}

	<div class="pointer-events-none absolute inset-y-1 right-1 flex items-center gap-1.5">
		{#if chevron}
			<ChevronDownIcon
				class="text-fg-subtle shrink-0 {chevron === 'sm' ? 'size-3.5' : 'size-4'}"
				aria-hidden="true"
			/>
		{/if}

		<div class="pointer-events-auto h-full">
			{@render action()}
		</div>
	</div>
</div>
