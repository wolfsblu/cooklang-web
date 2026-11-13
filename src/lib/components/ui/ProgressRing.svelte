<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The circular progress ring used by the shopping list and the unassigned
	 * ingredients page.
	 *
	 * `progress` is 0–1; the centre content is a snippet so callers can show a
	 * percentage or a completion check.
	 */
	interface Props {
		progress: number;
		/** Width and height utilities, e.g. "size-14 sm:size-16". */
		sizeClass?: string;
		tone?: 'accent' | 'ok';
		children?: Snippet;
	}

	const { progress, sizeClass = 'size-16', tone = 'accent', children }: Props = $props();

	const RADIUS = 17;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
</script>

<div class="relative shrink-0 {sizeClass}">
	<svg viewBox="0 0 40 40" class="{sizeClass} -rotate-90" aria-hidden="true">
		<circle
			cx="20"
			cy="20"
			r={RADIUS}
			fill="none"
			stroke="currentColor"
			stroke-width="3.5"
			class="text-surface-muted"
		/>
		<circle
			cx="20"
			cy="20"
			r={RADIUS}
			fill="none"
			stroke="currentColor"
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-dasharray={CIRCUMFERENCE}
			stroke-dashoffset={CIRCUMFERENCE * (1 - progress)}
			class="transition-all duration-500 ease-out {tone === 'ok' ? 'text-ok' : 'text-accent'}"
		/>
	</svg>

	<span class="absolute inset-0 flex items-center justify-center">
		{@render children?.()}
	</span>
</div>
