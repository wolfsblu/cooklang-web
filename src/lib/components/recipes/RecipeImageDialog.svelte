<script lang="ts">
	import { enhance } from '$app/forms';
	import { Dialog } from 'bits-ui';
	import { ImagePlusIcon, Trash2Icon, UploadIcon, XIcon } from '@lucide/svelte';
	import type { ImageRef } from '$lib/types/recipe';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';

	/**
	 * Add, replace or remove a recipe's cover image.
	 *
	 * The image lives beside the `.cook` file, following the Cooklang naming
	 * convention, so this is a file operation rather than recipe metadata.
	 * Uploading replaces it immediately; there is no separate Save step to
	 * forget, and the recipe text is never touched.
	 */
	interface Props {
		open: boolean;
		image: ImageRef | null;
		/** Recipe title, used in copy and the image alt text. */
		title: string;
	}

	let { open = $bindable(), image, title }: Props = $props();

	let uploadForm = $state<HTMLFormElement | null>(null);
	let removeForm = $state<HTMLFormElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	let uploading = $state(false);
	let removing = $state(false);
	let converting = $state(false);
	let confirmingRemove = $state(false);
	let error = $state<string | null>(null);
	let failedSrc = $state<string | null>(null);

	const shown = $derived(image && failedSrc !== image.src ? image : null);
	const busy = $derived(uploading || removing || converting);

	// A new visit starts clean rather than showing the previous attempt's error.
	$effect(() => {
		if (!open) return;
		error = null;
		confirmingRemove = false;
	});

	const HEIC_TYPE = /^image\/hei[cf]/i;
	const HEIC_NAME = /\.(heic|heif)$/i;
	/** Long edge for converted photos: plenty for a cover, quick to upload. */
	const HEIC_MAX_EDGE = 2560;

	function chooseFile(): void {
		fileInput?.click();
	}

	function isHeic(file: File): boolean {
		return HEIC_TYPE.test(file.type) || HEIC_NAME.test(file.name);
	}

	/**
	 * Convert an Apple photo to JPEG in the browser.
	 *
	 * Safari can decode HEIC, so an iPhone or Mac user never has to think about
	 * formats. Browsers that cannot decode it reject below, and the server also
	 * refuses the raw file rather than storing something half the web cannot
	 * display.
	 */
	async function convertHeic(file: File): Promise<File> {
		const url = URL.createObjectURL(file);

		try {
			const picture = new Image();
			picture.src = url;
			await picture.decode();

			const scale = Math.min(
				1,
				HEIC_MAX_EDGE / Math.max(picture.naturalWidth, picture.naturalHeight)
			);
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
			canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));

			const context = canvas.getContext('2d');
			if (!context) throw new Error('Canvas is unavailable');
			context.drawImage(picture, 0, 0, canvas.width, canvas.height);

			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, 'image/jpeg', 0.9)
			);
			if (!blob) throw new Error('The photo could not be encoded');

			return new File([blob], file.name.replace(HEIC_NAME, '') + '.jpg', {
				type: 'image/jpeg'
			});
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	async function submitUpload(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		error = null;

		if (!isHeic(file)) {
			uploadForm?.requestSubmit();
			return;
		}

		converting = true;
		try {
			const converted = await convertHeic(file);
			const transfer = new DataTransfer();
			transfer.items.add(converted);
			input.files = transfer.files;
			uploadForm?.requestSubmit();
		} catch {
			input.value = '';
			error =
				'This browser could not convert the HEIC photo. Export it as a JPEG (or take the photo in Most Compatible mode) and try again.';
		} finally {
			converting = false;
		}
	}

	function actionError(data: unknown, fallback: string): string {
		const message = (data as { message?: unknown } | null)?.message;
		return typeof message === 'string' ? message : fallback;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="bg-overlay anim-fade fixed inset-0 z-40" />

		<Dialog.Content
			class="bg-surface border-border shadow-pop anim-pop fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6"
		>
			<div class="mb-4 flex items-start justify-between gap-2">
				<div>
					<Dialog.Title class="text-fg text-lg font-semibold">Cover image</Dialog.Title>
					<Dialog.Description class="text-fg-muted mt-1 text-sm">
						The picture shown for “{title}” in the recipe list and at the top of the recipe.
					</Dialog.Description>
				</div>
				<Dialog.Close>
					{#snippet child({ props })}
						<IconButton {...props} size="sm" label="Close">
							<XIcon class="size-4" />
						</IconButton>
					{/snippet}
				</Dialog.Close>
			</div>

			{#if shown}
				<img
					src={shown.src}
					srcset={shown.srcset}
					width={shown.width}
					height={shown.height}
					alt={title}
					decoding="async"
					onerror={() => (failedSrc = shown?.src ?? null)}
					class="border-border aspect-[16/9] w-full rounded-lg border object-cover"
				/>
			{:else}
				<div
					class="border-border bg-surface-muted/40 flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center"
				>
					<ImagePlusIcon class="text-fg-subtle size-8" aria-hidden="true" />
					<p class="text-fg-muted px-4 text-sm">
						{image ? 'The current image could not be loaded.' : 'No cover image yet.'}
					</p>
				</div>
			{/if}

			{#if error}
				<p class="text-danger-soft-fg mt-3 text-sm" role="alert">{error}</p>
			{/if}

			<form
				bind:this={uploadForm}
				method="POST"
				action="?/updateImage"
				enctype="multipart/form-data"
				use:enhance={() => {
					uploading = true;
					error = null;

					return async ({ result, update }) => {
						uploading = false;
						// Clear the picker so choosing the same file again fires
						// another change event.
						if (fileInput) fileInput.value = '';

						if (result.type === 'success') {
							await update();
							open = false;
							return;
						}

						if (result.type === 'failure') {
							error = actionError(result.data, 'The image could not be saved.');
						} else if (result.type === 'error') {
							error = result.error?.message ?? 'The image could not be saved.';
						}
					};
				}}
			>
				<input
					bind:this={fileInput}
					type="file"
					name="image"
					accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
					class="sr-only"
					aria-label="Choose a cover image"
					onchange={submitUpload}
				/>
			</form>

			<div class="mt-4 flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="outline"
					loading={uploading || converting}
					disabled={busy}
					onclick={chooseFile}
				>
					{#if !uploading && !converting}
						<UploadIcon class="size-4" />
					{/if}
					{image ? 'Replace image' : 'Upload image'}
				</Button>

				{#if image}
					<form
						bind:this={removeForm}
						method="POST"
						action="?/removeImage"
						class="ml-auto"
						use:enhance={() => {
							removing = true;
							error = null;

							return async ({ result, update }) => {
								removing = false;

								if (result.type === 'success') {
									await update();
									open = false;
									return;
								}

								if (result.type === 'failure') {
									error = actionError(result.data, 'The image could not be removed.');
								} else if (result.type === 'error') {
									error = result.error?.message ?? 'The image could not be removed.';
								}
							};
						}}
					>
						<Button
							type="button"
							variant="danger"
							loading={removing}
							disabled={busy}
							onclick={() => (confirmingRemove = true)}
						>
							{#if !removing}
								<Trash2Icon class="size-4" />
							{/if}
							Remove
						</Button>
					</form>
				{/if}
			</div>

			<p class="text-fg-subtle mt-4 text-xs">
				JPEG, PNG or WebP, up to 20 MB. HEIC photos from an iPhone are converted to JPEG when your
				browser can read them. The file is saved next to the recipe, so other Cooklang tools see it
				too.
			</p>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<ConfirmDialog
	bind:open={confirmingRemove}
	title="Remove the cover image?"
	description="“{title}” will use the placeholder instead. The image file is deleted and this cannot be undone."
	confirmLabel="Remove image"
	destructive
	onconfirm={() => removeForm?.requestSubmit()}
/>
