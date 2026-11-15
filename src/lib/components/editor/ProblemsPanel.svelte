<script lang="ts">
	import {
		ChevronDownIcon,
		ChevronUpIcon,
		CircleCheckIcon,
		CircleHelpIcon,
		LoaderCircleIcon,
		TriangleAlertIcon
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { RecipeDiagnostic } from '#lib/types/editor.js';
	import { countLabel } from '#lib/utils/pluralize.js';

	/**
	 * The editor's bottom panel: a collapsible problems console shared by the
	 * recipe editor and the import review screen.
	 *
	 * When `details` is supplied, a second tab holds non-diagnostic information
	 * (for the importer: what was found on the page and which ingredient names
	 * were reused) instead of letting those messages compete with the recipe
	 * preview for vertical space.
	 */
	interface Props {
		diagnostics: RecipeDiagnostic[];
		loading?: boolean;
		open?: boolean;
		details?: Snippet;
		detailsLabel?: string;
		/** Warnings that belong to the details tab but still count as problems. */
		additionalProblemCount?: number;
		/** Warnings inside the details tab, shown beside its label. */
		detailsProblemCount?: number;
	}

	let {
		diagnostics,
		loading = false,
		open = $bindable(false),
		details,
		detailsLabel = 'Details',
		additionalProblemCount = 0,
		detailsProblemCount = 0
	}: Props = $props();

	type TabID = 'problems' | 'details';
	let activeTab = $state<TabID>('problems');

	const syntaxProblemCount = $derived(
		diagnostics.filter((diagnostic) => diagnostic.severity !== 'help').length
	);
	const problemCount = $derived(syntaxProblemCount + additionalProblemCount);

	function diagnosticClass(severity: RecipeDiagnostic['severity']): string {
		if (severity === 'error') return 'text-danger';
		if (severity === 'warning') return 'text-warn-soft-fg';
		return 'text-fg-subtle';
	}

	function diagnosticIcon(severity: RecipeDiagnostic['severity']) {
		return severity === 'help' ? CircleHelpIcon : TriangleAlertIcon;
	}
</script>

<div class="border-border shrink-0 border-t">
	<button
		type="button"
		class="hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100"
		onclick={() => (open = !open)}
		aria-expanded={open}
		aria-controls="problems-console"
	>
		{#if problemCount > 0}
			<TriangleAlertIcon class="text-warn-soft-fg size-3.5 shrink-0" />
			<span class="text-fg text-xs font-medium">
				{countLabel(problemCount, 'problem')}
			</span>
		{:else}
			<CircleCheckIcon class="text-ok size-3.5 shrink-0" />
			<span class="text-fg text-xs font-medium">No problems</span>
		{/if}

		{#if loading}
			<span class="text-fg-subtle inline-flex items-center gap-1 text-xs">
				<LoaderCircleIcon class="size-3 animate-spin" />
				Checking…
			</span>
		{/if}

		<span class="text-fg-subtle ml-auto inline-flex items-center gap-1 text-xs">
			{#if details}
				{activeTab === 'details' ? detailsLabel : 'Syntax'}
			{:else}
				Syntax
			{/if}
			{#if open}
				<ChevronDownIcon class="size-3.5" />
			{:else}
				<ChevronUpIcon class="size-3.5" />
			{/if}
		</span>
	</button>

	{#if open}
		<div id="problems-console" class="border-border max-h-56 overflow-y-auto border-t">
			{#if details}
				<div
					class="border-border bg-surface-muted/40 flex shrink-0 items-center gap-1 border-b px-1"
					role="tablist"
					aria-label="Editor panel"
				>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === 'problems'}
						aria-controls="problems-panel"
						tabindex={activeTab === 'problems' ? 0 : -1}
						class="flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs font-medium transition-colors duration-100 {activeTab ===
						'problems'
							? 'border-accent text-fg'
							: 'text-fg-muted hover:text-fg border-transparent'}"
						onclick={() => (activeTab = 'problems')}
					>
						Syntax
						<span class="text-fg-subtle tabular-nums">{syntaxProblemCount}</span>
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={activeTab === 'details'}
						aria-controls="details-panel"
						tabindex={activeTab === 'details' ? 0 : -1}
						class="flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-xs font-medium transition-colors duration-100 {activeTab ===
						'details'
							? 'border-accent text-fg'
							: 'text-fg-muted hover:text-fg border-transparent'}"
						onclick={() => (activeTab = 'details')}
					>
						{detailsLabel}
						{#if detailsProblemCount > 0}
							<span class="text-warn-soft-fg tabular-nums">{detailsProblemCount}</span>
						{/if}
					</button>
				</div>
			{/if}

			{#if details && activeTab === 'details'}
				<div id="details-panel" role="tabpanel" aria-label={detailsLabel}>
					{@render details()}
				</div>
			{:else}
				<div id="problems-panel" role="tabpanel" aria-label="Syntax">
					{#if diagnostics.length > 0}
						<ul class="divide-border divide-y">
							{#each diagnostics as diagnostic, index (index)}
								{@const Icon = diagnosticIcon(diagnostic.severity)}
								{@const [summary, ...snippet] = diagnostic.message.split('\n')}
								<li class="flex items-start gap-2 px-3 py-1.5 text-xs">
									<Icon class="mt-0.5 size-3.5 shrink-0 {diagnosticClass(diagnostic.severity)}" />
									<div class="min-w-0">
										<p class="text-fg">{summary}</p>
										{#if snippet.length > 0}
											<pre
												class="text-fg-muted text-2xs mt-1 overflow-x-auto font-mono leading-5">{snippet.join(
													'\n'
												)}</pre>
										{/if}
										{#if diagnostic.line}
											<p class="text-fg-subtle">Line {diagnostic.line}</p>
										{/if}
									</div>
									<span class="text-fg-subtle ml-auto capitalize">{diagnostic.severity}</span>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-fg-subtle px-3 py-2 text-xs">No parser warnings for this recipe.</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
