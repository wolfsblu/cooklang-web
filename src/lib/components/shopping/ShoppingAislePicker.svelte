<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import AisleCategoryField from '#lib/components/aisles/AisleCategoryField.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	interface Props {
		/** The ingredient name as the CLI emitted it. */
		itemName: string;
		categories: string[];
		/** Where the action should send the browser back to. */
		returnTo: string;
	}

	const { itemName, categories, returnTo }: Props = $props();

	/**
	 * The action redirects back to `returnTo` on success, and redirects are
	 * always followed. A failure, though, carries this form's location
	 * (`/ingredients/unassigned`), which SvelteKit 3 would navigate to; `navigate:
	 * false` applies failures to the current page instead.
	 */
	const submit: SubmitFunction =
		() =>
		async ({ update }) => {
			await update({ navigate: false });
		};
</script>

<!--
	Posts to the aisles route rather than to a local action, so the file-writing
	and its validation live in one place. The action redirects back to `returnTo`,
	which re-runs this page's load: the shopping list's cache key includes the
	aisle file's stamp, so the item comes back under its new heading. Without
	JavaScript this is a plain POST and a 303; with it, enhance follows the
	redirect via goto.
-->
<form
	method="POST"
	action="/ingredients/unassigned?/assign"
	use:enhance={submit}
	class="flex w-full shrink-0 items-center gap-1.5"
>
	<input type="hidden" name="name" value={itemName} />
	<input type="hidden" name="returnTo" value={returnTo} />

	<AisleCategoryField {categories} label="Aisle for {itemName}" size="sm" fullWidth>
		{#snippet action()}
			<Button type="submit" size="sm" variant="soft" class="h-full px-2 text-xs">Assign</Button>
		{/snippet}
	</AisleCategoryField>
</form>
