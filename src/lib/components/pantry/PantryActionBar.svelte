<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { PencilIcon, PlusIcon, Trash2Icon } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { countLabel } from '$lib/utils/pluralize';

	/**
	 * The current folder's actions, as a flat icon toolbar like the recipe
	 * detail's action bar: edit and delete the folder, then the primary "Add
	 * item" action after a hairline rule.
	 *
	 * "All items" is not a folder, so the first two are omitted there rather
	 * than shown disabled with nothing to explain why.
	 */
	interface Props {
		/** The folder being browsed, or null for "All items". */
		folder: string | null;
		/** Items in that folder, for the delete confirmation. */
		itemCount: number;
		onadd: () => void;
		onrename: () => void;
		/** Render "Add item" as an icon, for the narrow mobile toolbar. */
		compact?: boolean;
	}

	let { folder, itemCount, onadd, onrename, compact = false }: Props = $props();

	let confirmingDelete = $state(false);
	let deleteForm = $state<HTMLFormElement | null>(null);

	const deleteDescription = $derived(
		itemCount > 0
			? `“${folder}” contains ${countLabel(itemCount, 'item')}. Deleting the folder removes everything in it, and cannot be undone.`
			: 'This folder is empty. Deleting it cannot be undone.'
	);
</script>

<div class="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label="Pantry actions">
	{#if folder}
		<IconButton label="Rename folder {folder}" variant="toolbar" size="sm" onclick={onrename}>
			<PencilIcon class="size-4" />
		</IconButton>

		<form
			method="POST"
			action="?/removeSection"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type !== 'success') return;
					// Apply the invalidate before going to the same route without
					// ?folder=: a query-only navigation reuses the page's data, so
					// the deleted folder would linger.
					await update();
					// The folder being browsed is gone, so land on "All items"
					// rather than leaving a dead ?folder= in the URL.
					await goto('/pantry');
				}}
			bind:this={deleteForm}
			class="flex"
		>
			<input type="hidden" name="name" value={folder} />
			<IconButton
				type="button"
				label="Delete folder {folder}"
				variant="toolbar"
				size="sm"
				class="hover:text-danger-soft-fg"
				onclick={() => (confirmingDelete = true)}
			>
				<Trash2Icon class="size-4" />
			</IconButton>
		</form>

		<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>
	{/if}

	{#if compact}
		<IconButton label="Add item" variant="primary" size="sm" onclick={onadd}>
			<PlusIcon class="size-4" />
		</IconButton>
	{:else}
		<Button size="sm" onclick={onadd}>
			<PlusIcon class="size-4" />
			Add item
		</Button>
	{/if}
</div>

<ConfirmDialog
	bind:open={confirmingDelete}
	title={folder ? `Delete “${folder}”?` : 'Delete folder?'}
	description={deleteDescription}
	confirmLabel="Delete folder"
	destructive
	onconfirm={() => deleteForm?.requestSubmit()}
/>
