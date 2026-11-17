<script lang="ts">
	import { CalendarDaysIcon } from '@lucide/svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Page from '#lib/components/ui/Page.svelte';
</script>

<svelte:head>
	<title>Meal plan</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<header class="border-border flex shrink-0 items-center border-b px-4 py-3">
			<h1 class="text-fg text-base font-semibold">Meal plan</h1>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto">
			<EmptyState
				icon={CalendarDaysIcon}
				title="Meal plan is on the way"
				description="Soon you will be able to pick recipes for each day of the week and send the whole plan to your shopping list."
			>
				{#snippet actions()}
					<Button href="/">Browse recipes</Button>
				{/snippet}
			</EmptyState>
		</div>
	</div>
</Page>
