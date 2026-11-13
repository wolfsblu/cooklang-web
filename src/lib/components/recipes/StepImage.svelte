<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { XIcon } from '@lucide/svelte';
	import type { ImageRef } from '$lib/types/recipe';
	import IconButton from '$lib/components/ui/IconButton.svelte';

	/**
	 * A step photograph, shown small enough not to break the flow of the
	 * instructions, that expands to the full image when clicked. The thumbnail
	 * keeps its real aspect ratio (both `width` and `height` are auto) while the
	 * caps apply, instead of being squashed into a fixed box.
	 */
	interface Props {
		image: ImageRef;
		/** 1-based position in the whole recipe, for the alt text and dialog label. */
		ordinal: number;
	}

	const { image, ordinal }: Props = $props();

	let open = $state(false);
</script>

<button
	type="button"
	class="focus-visible:ring-accent mt-3 block cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
	aria-label="Enlarge step {ordinal} image"
	onclick={() => (open = true)}
>
	<img
		src={image.src}
		srcset={image.srcset}
		width={image.width}
		height={image.height}
		loading="lazy"
		decoding="async"
		alt="Step {ordinal}"
		class="border-border h-auto max-h-36 w-auto max-w-full rounded-lg border object-cover shadow-sm transition-transform duration-150 hover:scale-[1.02]"
	/>
</button>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="bg-overlay anim-fade fixed inset-0 z-40" />

		<Dialog.Content
			class="anim-pop fixed top-1/2 left-1/2 z-50 w-auto max-w-[95vw] -translate-x-1/2 -translate-y-1/2"
		>
			<Dialog.Title class="sr-only">Step {ordinal} image</Dialog.Title>

			<div class="relative">
				<img
					src={image.src}
					srcset={image.srcset}
					width={image.width}
					height={image.height}
					alt="Step {ordinal}"
					class="shadow-pop max-h-[85vh] w-auto max-w-[95vw] rounded-lg object-contain"
				/>

				<Dialog.Close>
					{#snippet child({ props })}
						<IconButton
							{...props}
							label="Close"
							class="bg-surface/90 absolute top-2 right-2 shadow"
						>
							<XIcon class="size-4" />
						</IconButton>
					{/snippet}
				</Dialog.Close>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
