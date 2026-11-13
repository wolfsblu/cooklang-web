<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { CheckIcon, ShoppingCartIcon, XIcon } from '@lucide/svelte';
	import { formatScale } from '$lib/utils/scale';
	import Button, { type ButtonVariant } from '$lib/components/ui/Button.svelte';

	/**
	 * Add, update or remove the current recipe.
	 *
	 * This previously read a client store that nothing on the recipe page ever
	 * populated, so it always rendered "Add" -- even for a recipe already in the
	 * list -- and clicking it re-added the recipe, silently resetting its scale
	 * to 1. It also hardcoded scale 1, ignoring the servings control right
	 * beside it. Membership now comes from the server load, and the live scale
	 * is submitted with the form.
	 */
	interface Props {
		slug: string;
		scale: number;
		inList: boolean;
		listedScale: number | null;
		/** Passed to the button, so callers can shape it to their layout. */
		class?: string;
		/** Drops the label below `sm`, so the action bar fits a narrow phone. */
		compact?: boolean;
		/** Renders as an icon-only button in a flat toolbar. */
		toolbar?: boolean;
	}

	const {
		slug,
		scale,
		inList,
		listedScale,
		class: className,
		compact = false,
		toolbar = false
	}: Props = $props();

	const scaleDiffers = $derived(inList && listedScale !== null && listedScale !== scale);

	const state = $derived(inList && !scaleDiffers ? 'remove' : scaleDiffers ? 'update' : 'add');

	const label = $derived(
		state === 'remove'
			? 'Remove from list'
			: state === 'update'
				? `Update to ${formatScale(scale)}×`
				: 'Add to list'
	);

	// The label is the accessible name whether or not it is on screen, so the
	// compact button is not an unlabelled icon.
	const labelClass = $derived(compact ? 'hidden sm:inline' : '');

	const Icon = $derived(
		state === 'remove' ? XIcon : state === 'update' ? CheckIcon : ShoppingCartIcon
	);

	const variant: ButtonVariant = $derived(
		toolbar ? 'toolbar' : state === 'remove' ? 'dangerSoft' : 'soft'
	);

	// Removing is destructive even as an icon, and updating a listed recipe is
	// a change worth noticing; both keep their tone in toolbar form.
	const tone = $derived(
		!toolbar
			? ''
			: state === 'remove'
				? 'text-danger-soft-fg hover:bg-danger-soft'
				: state === 'update'
					? 'text-warn-soft-fg hover:bg-warn-soft'
					: ''
	);

	const classes = $derived(
		[toolbar ? 'size-8 shrink-0 p-0' : '', tone, className ?? ''].filter(Boolean).join(' ')
	);

	const submit =
		() =>
		async ({ update }: { update: () => Promise<void> }) => {
			await update();
			// The shopping count in the nav lives in the root layout.
			await invalidateAll();
		};
</script>

<form
	method="POST"
	action={state === 'remove' ? '/shopping?/remove' : '/shopping?/add'}
	use:enhance={submit}
>
	<input type="hidden" name="slug" value={slug} />
	{#if state !== 'remove'}
		<input type="hidden" name="scale" value={scale} />
	{/if}

	<Button type="submit" {variant} class={classes} aria-label={label} title={label}>
		<Icon class="size-4" />
		{#if !toolbar}
			<span class={labelClass}>{label}</span>
		{/if}
	</Button>
</form>
