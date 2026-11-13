<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Dialog } from 'bits-ui';
	import { XIcon } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';

	interface Props {
		open: boolean;
		/** The folder being renamed. */
		folder: string;
	}

	let { open = $bindable(), folder }: Props = $props();

	let name = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);

	// Reopening the dialog starts from the folder's current name rather than
	// whatever was typed last time, and drops a stale error.
	$effect(() => {
		if (open) {
			name = folder;
			error = null;
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="bg-overlay anim-fade fixed inset-0 z-40" />

		<Dialog.Content
			class="bg-surface border-border shadow-pop anim-pop fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-6"
		>
			<div class="mb-4 flex items-start justify-between gap-2">
				<Dialog.Title class="text-fg text-lg font-semibold">Rename folder</Dialog.Title>
				<Dialog.Close>
					{#snippet child({ props })}
						<IconButton {...props} size="sm" label="Close">
							<XIcon class="size-4" />
						</IconButton>
					{/snippet}
				</Dialog.Close>
			</div>

			<form
				method="POST"
				action="?/renameSection"
				use:enhance={({ formData }) =>
					async ({ result, update }) => {
						if (result.type === 'failure') {
							// A collision with an existing folder is the likely failure;
							// show the action's message instead of closing the dialog.
							error =
								(result.data as { message?: string } | undefined)?.message ??
								'Could not rename the folder.';
							saving = false;
							return;
						}

						if (result.type !== 'success') {
							error = 'Could not rename the folder.';
							saving = false;
							return;
						}

						// `goto` between two ?folder= URLs does not re-run the page's
						// load (everything else about the page is unchanged), so apply
						// the action's invalidate first; otherwise the renamed folder is
						// not in `data.sections` yet and the header falls back to "All".
						await update();
						open = false;
						saving = false;

						// Follow the folder to its new name; the old one is gone, and
						// staying on ?folder=<old> would silently drop to "All items".
						const next = String(formData.get('name') ?? '').trim();
						if (next) await goto(`/pantry?folder=${encodeURIComponent(next)}`);
					}}
				class="space-y-4"
				onsubmit={() => (saving = true)}
			>
				<input type="hidden" name="from" value={folder} />

				<div>
					<label for="pantry-rename-folder" class="text-fg mb-1 block text-sm font-medium">
						Name
					</label>
					<input
						id="pantry-rename-folder"
						name="name"
						class="field"
						bind:value={name}
						placeholder="freezer"
						required
					/>
				</div>

				{#if error}
					<p class="text-danger-soft-fg text-sm" role="alert">{error}</p>
				{/if}

				<div class="flex justify-end gap-2">
					<Dialog.Close>
						{#snippet child({ props })}
							<Button {...props} type="button" variant="ghost" disabled={saving}>Cancel</Button>
						{/snippet}
					</Dialog.Close>
					<Button type="submit" loading={saving}>Save</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
