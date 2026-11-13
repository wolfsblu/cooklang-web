<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	const { class: className, children }: Props = $props();
</script>

<!--
	A no-gap action cluster: the inner corners are square so adjacent buttons
	join cleanly, while the outer corners stay rounded. The buttons are not
	clipped, so their focus rings remain visible.
-->
<div
	class="flex shrink-0 items-center justify-end [&_button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>form:first-child>button]:rounded-l-md [&>form:last-child>button]:rounded-r-md {className ??
		''}"
>
	{@render children()}
</div>
