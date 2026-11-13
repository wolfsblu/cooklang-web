<script lang="ts">
	import type { ImageRef } from '$lib/types/recipe';

	/**
	 * The recipe's hero images, as a full-width strip at the top on mobile.
	 *
	 * The image used to open the ingredients panel, which made the panel tall
	 * before its useful content began. Above the title bar it reads as the
	 * recipe's cover; when there is more than one, they scroll sideways one
	 * screen at a time instead of stacking down the page.
	 */
	interface Props {
		images: ImageRef[];
		title?: string;
	}

	const { images, title = 'Recipe' }: Props = $props();

	// Track failures by URL so one broken image does not hide the rest, and a
	// failing image disappearing does not leave an empty gap.
	let failed = $state<Record<string, boolean>>({});
	const visible = $derived(images.filter((image) => !failed[image.src]));
</script>

{#if visible.length > 0}
	<div
		class="border-border bg-surface-muted/30 no-scrollbar flex shrink-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain border-b lg:hidden"
		role="group"
		aria-label="Recipe images"
	>
		{#each visible as image, index (image.src)}
			<img
				src={image.src}
				srcset={image.srcset}
				width={image.width}
				height={image.height}
				alt={visible.length > 1 ? `${title} image ${index + 1}` : title}
				onerror={() => (failed[image.src] = true)}
				fetchpriority={index === 0 ? 'high' : 'auto'}
				decoding="async"
				class="h-auto w-full shrink-0 snap-start object-cover"
			/>
		{/each}
	</div>
{/if}
