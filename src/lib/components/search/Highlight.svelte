<script lang="ts">
	import { highlightSegments } from '$lib/utils/search-match';

	/**
	 * Renders text with the matched query fragments marked.
	 *
	 * Svelte escapes each segment normally; the markup comes from splitting the
	 * string, never from injecting HTML, so a recipe title containing angle
	 * brackets stays text.
	 */
	interface Props {
		text: string;
		query: string;
	}

	const { text, query }: Props = $props();

	const segments = $derived(highlightSegments(text, query));
</script>

{#each segments as segment, index (index)}{#if segment.match}<mark
			class="bg-accent-soft text-accent-soft-fg rounded-xs px-0.5">{segment.text}</mark
		>{:else}{segment.text}{/if}{/each}
