<script lang="ts">
	import { ImagePlusIcon, PencilIcon } from '@lucide/svelte';
	import type { ImageRef } from '$lib/types/recipe';

	/**
	 * The recipe's cover image as an edit target.
	 *
	 * A real photo stays a photo: it fills its slot and reveals a "Change
	 * image" chip on hover, or persistently on touch screens where hovering is
	 * not available. With no image -- or a file that fails to load -- the same
	 * slot becomes a dashed placeholder that reads as an empty field rather
	 * than a broken image.
	 */
	interface Props {
		image: ImageRef | null;
		title: string;
		onedit: () => void;
		class?: string;
		imageClass?: string;
	}

	let { image, title, onedit, class: className = '', imageClass = '' }: Props = $props();

	let failedSrc = $state<string | null>(null);

	const shown = $derived(image && failedSrc !== image.src ? image : null);
	const label = $derived(image ? 'Change cover image' : 'Add cover image');
</script>

<button
	type="button"
	class="group focus-visible:ring-accent relative block cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset {className}"
	aria-label="{label} for {title}"
	onclick={onedit}
>
	{#if shown}
		<img
			src={shown.src}
			srcset={shown.srcset}
			width={shown.width}
			height={shown.height}
			alt={title}
			fetchpriority="high"
			decoding="async"
			onerror={() => (failedSrc = shown?.src ?? null)}
			class={imageClass}
		/>

		<!-- Desktop gets a hover scrim; touch devices keep the chip visible. -->
		<span
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 bg-neutral-950/0 transition-colors duration-150 group-hover:bg-neutral-950/20"
		></span>
		<span
			aria-hidden="true"
			class="text-neutral-0 pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-950/75 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm transition-opacity duration-150 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
		>
			<PencilIcon class="size-3.5" />
			Change image
		</span>
	{:else}
		<span
			class="border-border bg-surface-muted/40 hover:bg-surface-muted flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 border border-dashed text-center transition-colors duration-150"
		>
			<ImagePlusIcon class="text-fg-subtle size-6" aria-hidden="true" />
			<span class="text-fg-muted px-4 text-xs font-medium sm:text-sm">
				{image ? 'Replace cover image' : 'Add cover image'}
			</span>
		</span>
	{/if}
</button>
