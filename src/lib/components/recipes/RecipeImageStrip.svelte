<script lang="ts">
	import type { ImageRef } from '$lib/types/recipe';
	import RecipeCoverImage from './RecipeCoverImage.svelte';

	/**
	 * The recipe's hero images, as a full-width strip at the top on mobile.
	 *
	 * The image used to open the ingredients panel, which made the panel tall
	 * before its useful content began. Above the title bar it reads as the
	 * recipe's cover; when there is more than one, they scroll sideways one
	 * screen at a time instead of stacking down the page. When the recipe has
	 * no image, the strip becomes the "add cover image" affordance, so the
	 * control is in the same place whether or not a photo exists.
	 */
	interface Props {
		images: ImageRef[];
		title?: string;
		/** Whether clicking an image (or the empty slot) opens the image editor. */
		editable?: boolean;
		onedit?: () => void;
	}

	const { images, title = 'Recipe', editable = false, onedit = () => {} }: Props = $props();
</script>

{#if images.length > 0 || editable}
	<div
		class="border-border bg-surface-muted/30 no-scrollbar flex shrink-0 snap-x snap-mandatory overflow-x-auto overscroll-x-contain border-b lg:hidden"
		role="group"
		aria-label="Recipe images"
	>
		{#if images.length > 0}
			{#each images as image (image.src)}
				<RecipeCoverImage
					{image}
					{title}
					{onedit}
					class="w-full shrink-0 snap-start"
					imageClass="h-auto w-full object-cover"
				/>
			{/each}
		{:else}
			<RecipeCoverImage image={null} {title} {onedit} class="w-full" />
		{/if}
	</div>
{/if}
