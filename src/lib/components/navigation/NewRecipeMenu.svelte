<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { DropdownMenu } from 'bits-ui';
	import { ChevronDownIcon, PlusIcon, SparklesIcon } from '@lucide/svelte';

	/**
	 * Split control for adding a recipe: the plus starts a blank one, the caret
	 * lists the paths that already exist. Import is the only one wired up, so
	 * the primary half is a placeholder that says as much rather than looking
	 * like a click that failed.
	 */
	let notice = $state<string | null>(null);
	let noticeTimer: ReturnType<typeof setTimeout> | null = null;

	function createRecipe() {
		notice = 'Creating a new recipe is coming soon.';
		if (noticeTimer) clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = null), 4000);
	}

	onDestroy(() => {
		if (noticeTimer) clearTimeout(noticeTimer);
	});
</script>

<div class="relative">
	<div class="border-border bg-surface flex items-center rounded-md border">
		<button
			type="button"
			class="text-fg-muted hover:bg-surface-muted hover:text-fg flex h-9 w-9 items-center justify-center rounded-l-md transition-colors duration-150"
			aria-label="New recipe"
			title="New recipe"
			onclick={createRecipe}
		>
			<PlusIcon class="size-4" />
		</button>

		<!-- The hairline keeps the two hit areas reading as one control while
		     staying a separate, independently focusable button. -->
		<span class="bg-border h-5 w-px shrink-0" aria-hidden="true"></span>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="text-fg-muted hover:bg-surface-muted hover:text-fg flex h-9 w-7 items-center justify-center rounded-r-md transition-colors duration-150"
				aria-label="More ways to add a recipe"
				title="More ways to add a recipe"
			>
				<ChevronDownIcon class="size-3.5" />
			</DropdownMenu.Trigger>

			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="end"
					sideOffset={6}
					class="bg-surface border-border shadow-pop z-50 min-w-52 rounded-md border p-1"
				>
					<DropdownMenu.Item
						class="data-highlighted:bg-accent-soft data-highlighted:text-accent-soft-fg flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
						onSelect={() => goto('/recipes/import')}
					>
						<SparklesIcon class="text-fg-subtle size-4 shrink-0" />
						Import
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	</div>

	{#if notice}
		<div
			class="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4"
			role="status"
			aria-live="polite"
		>
			<div
				class="notice-toast bg-fg text-canvas shadow-pop flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
			>
				{notice}
			</div>
		</div>
	{/if}
</div>

<style>
	.notice-toast {
		animation: notice-toast-in 250ms cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	@keyframes notice-toast-in {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.96);
		}
	}
</style>
