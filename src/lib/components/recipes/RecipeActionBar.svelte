<script lang="ts">
	import { CookingPotIcon, PencilIcon } from '@lucide/svelte';
	import AddToShoppingListButton from '$lib/components/shopping/AddToShoppingListButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';

	/**
	 * What you can do with the recipe, as a flat icon toolbar in the title bar.
	 *
	 * Every action is an icon button with a tooltip, separated from the primary
	 * action by a hairline rule. This used to be a bordered strip of full-size
	 * labelled buttons, which read as a segmented control and took enough
	 * width to truncate the recipe title on a tablet or a phone.
	 */
	interface Props {
		slug: string;
		scale: number;
		inShoppingList: boolean;
		listedScale: number | null;
		onstartcooking: () => void;
	}

	const { slug, scale, inShoppingList, listedScale, onstartcooking }: Props = $props();
</script>

<div class="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label="Recipe actions">
	<AddToShoppingListButton {slug} {scale} inList={inShoppingList} {listedScale} toolbar />

	<Button
		href="/recipes/edit/{slug}"
		variant="toolbar"
		size="sm"
		class="size-8 shrink-0 p-0"
		aria-label="Edit recipe"
		title="Edit recipe"
	>
		<PencilIcon class="size-4" />
	</Button>

	<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>

	<IconButton label="Start cooking" variant="primary" size="sm" onclick={onstartcooking}>
		<CookingPotIcon class="size-4" />
	</IconButton>
</div>
