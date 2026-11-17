<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		ArrowLeftIcon,
		CameraIcon,
		CircleCheckIcon,
		GlobeIcon,
		ImagePlusIcon,
		InfoIcon,
		LoaderCircleIcon,
		PencilIcon,
		SaveIcon,
		SparklesIcon,
		Trash2Icon,
		TriangleAlertIcon
	} from '@lucide/svelte';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';
	import type { RecipeDiagnostic, RecipePreview } from '#lib/types/editor.js';
	import type { ImportFailure, ImportedRecipeDraft } from '#lib/types/import.js';
	import { isInsideEntity, mergeCompletionTerms } from '#lib/utils/cooklang-completion.js';
	import { setFrontmatterTitle } from '#lib/utils/cooklang-title.js';
	import { formatBytes, IMAGE_ACCEPT, prepareImportImage } from '#lib/utils/image.js';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Drawer from '#lib/components/ui/Drawer.svelte';
	import Page from '#lib/components/ui/Page.svelte';
	import Toggle from '#lib/components/ui/Toggle.svelte';
	import AiThinking from '#lib/components/editor/AiThinking.svelte';
	import CooklangCheatsheet from '#lib/components/editor/CooklangCheatsheet.svelte';
	import CooklangCodeMirror from '#lib/components/editor/CooklangCodeMirror.svelte';
	import type { SourceEditorHandle } from '#lib/components/editor/CooklangCodeMirror.svelte';
	import CooklangPreview from '#lib/components/editor/CooklangPreview.svelte';
	import CooklangToolbar from '#lib/components/editor/CooklangToolbar.svelte';
	import ProblemsPanel from '#lib/components/editor/ProblemsPanel.svelte';

	const { data }: PageProps = $props();

	let url = $state('');
	let importing = $state(false);
	let importError = $state<string | null>(null);

	let draft = $state<ImportedRecipeDraft | null>(null);
	let source = $state('');
	let preview = $state<RecipePreview | null>(null);
	let previewError = $state<{ message: string; line: number | null } | null>(null);
	let previewLoading = $state(false);
	let lastPreviewed = $state('');
	let previewTimer: ReturnType<typeof setTimeout> | null = null;
	let previewAbort: AbortController | null = null;

	let editedTitle = $state('');
	let lastAppliedTitle = $state('');
	let titleMeasure = $state<HTMLSpanElement | null>(null);
	let titleWidth = $state(160);
	let filename = $state('');
	let filenameDirty = $state(false);
	let folder = $state('');
	let creating = $state(false);
	let createError = $state<string | null>(null);
	let panelOpen = $state(true);

	let formEl = $state<HTMLFormElement | null>(null);
	let sourceEditor = $state<SourceEditorHandle | null>(null);
	let cmHistory = $state({ undo: 0, redo: 0 });
	let wrap = $state(true);
	let viewMode = $state<'write' | 'split' | 'preview'>('split');
	let cheatsheetOpen = $state(false);

	type ImportSource = 'url' | 'photo';

	function preferredSource(): ImportSource {
		return data.visionConfigured && !data.aiConfigured ? 'photo' : 'url';
	}

	// Start on the source the deployment can actually handle. When both work,
	// URL is still the more precise input, so it stays first.
	let sourceMode = $state<ImportSource>(preferredSource());
	let importKind = $state<ImportSource>('url');

	let photoFile = $state<File | null>(null);
	let photoPreview = $state<string | null>(null);
	let photoDimensions = $state<{ width: number; height: number } | null>(null);
	let photoPreparing = $state(false);
	let photoError = $state<string | null>(null);
	let photoDragging = $state(false);
	let usePhotoAsCover = $state(false);
	let photoInput = $state<HTMLInputElement | null>(null);
	let coverInput = $state<HTMLInputElement | null>(null);
	let photoLoadId = 0;

	const anyConfigured = $derived(data.aiConfigured || data.visionConfigured);
	const sources = [
		{ id: 'url' as const, label: 'From URL', icon: GlobeIcon },
		{ id: 'photo' as const, label: 'From photo', icon: CameraIcon }
	];

	const ingredientCount = $derived(preview?.display.ingredients.length ?? 0);
	const stepCount = $derived(
		preview?.display.sections.reduce(
			(total, section) => total + section.content.filter((item) => item.type === 'step').length,
			0
		) ?? 0
	);

	type LogTone = 'success' | 'warning' | 'info';

	interface ImportLogEntry {
		tone: LogTone;
		message: string;
		detail?: string;
	}

	const importLogEntries = $derived.by((): ImportLogEntry[] => {
		const current = draft;
		if (!current) return [];

		const entries: ImportLogEntry[] = [];

		if (current.sourceKind === 'photo') {
			entries.push({
				tone: 'info',
				message: 'Source photo',
				detail: current.photoName ?? 'Uploaded photo'
			});
		} else {
			entries.push({ tone: 'info', message: 'Source page', detail: current.sourceUrl ?? '' });
			entries.push(
				current.structured
					? { tone: 'success', message: 'Found structured recipe data on the page.' }
					: {
							tone: 'info',
							message: 'Used the visible page text; no structured recipe data was found.'
						}
			);
		}

		if (current.sourceKind === 'photo') {
			entries.push(
				usePhotoAsCover && photoFile
					? { tone: 'success', message: 'The photo will be saved as the recipe cover.' }
					: {
							tone: 'info',
							message: 'The photo is only used for reading; add a cover later if you want one.'
						}
			);
		} else if (current.imageUrl) {
			entries.push({
				tone: 'success',
				message: 'Found a cover image.',
				detail: current.imageUrl
			});
		} else {
			entries.push({ tone: 'warning', message: 'No cover image was found on the page.' });
		}

		entries.push({
			tone: 'info',
			message: `Generated ${ingredientCount} ${ingredientCount === 1 ? 'ingredient' : 'ingredients'} and ${stepCount} ${stepCount === 1 ? 'step' : 'steps'} with ${current.model}.`
		});

		if (current.matches.length > 0) {
			entries.push({
				tone: 'success',
				message: `Reused ${current.matches.length} existing ingredient ${current.matches.length === 1 ? 'name' : 'names'}.`,
				detail: current.matches.map((match) => `${match.from} → ${match.to}`).join(' · ')
			});
		} else {
			entries.push({
				tone: 'info',
				message:
					'No existing ingredient names needed rewriting; new names will extend the library vocabulary.'
			});
		}

		return entries;
	});

	const importProblemCount = $derived(
		importLogEntries.filter((entry) => entry.tone === 'warning').length
	);

	function logToneClass(tone: LogTone): string {
		if (tone === 'success') return 'text-ok';
		if (tone === 'warning') return 'text-warn-soft-fg';
		return 'text-fg-subtle';
	}

	const diagnostics = $derived<RecipeDiagnostic[]>(
		previewError
			? [{ severity: 'error', message: previewError.message, line: previewError.line }]
			: (preview?.diagnostics ?? [])
	);

	const terms = $derived({
		ingredient: mergeCompletionTerms(
			data.vocabulary.ingredients,
			preview?.display.ingredients.map((ingredient) => ingredient.name) ?? []
		),
		cookware: mergeCompletionTerms(
			data.vocabulary.cookware,
			preview?.display.cookware.map((item) => item.name) ?? []
		)
	});

	function failureMessage(data: unknown): string {
		return (data as ImportFailure | undefined)?.message ?? 'Something went wrong.';
	}

	function handleImport(kind: ImportSource) {
		return () => {
			importing = true;
			importKind = kind;
			importError = null;

			return async ({ result }: { result: ActionResult }) => {
				importing = false;

				if (result.type === 'success') {
					const payload = result.data as ImportedRecipeDraft | undefined;
					if (!payload?.ok) return;

					draft = payload;
					source = payload.source;
					preview = payload.preview;
					lastPreviewed = payload.source;
					previewError = null;
					editedTitle = payload.title;
					lastAppliedTitle = payload.title;
					filename = payload.suggestedName;
					filenameDirty = false;
					folder = '';
					createError = null;
					return;
				}

				if (result.type === 'failure') {
					importError = failureMessage(result.data);
					return;
				}

				if (result.type === 'error') {
					importError = result.error?.message ?? 'The recipe could not be imported.';
				}
			};
		};
	}

	function assignFile(input: HTMLInputElement | null, file: File): void {
		if (!input) return;
		const transfer = new DataTransfer();
		transfer.items.add(file);
		input.files = transfer.files;
	}

	/**
	 * Decode, downscale and normalise the chosen photo before anything is sent.
	 * The prepared file is also what the cover-image step will reuse, so the
	 * user is not asked to pick it twice.
	 */
	async function loadPhoto(raw: File): Promise<void> {
		photoError = null;

		if (!/^image\//u.test(raw.type) && !/\.(jpe?g|png|webp|heic|heif)$/iu.test(raw.name)) {
			photoError = 'Choose a JPEG, PNG, WebP or HEIC photo.';
			return;
		}

		// A second pick supersedes the first, even when the first decode is slow.
		const loadId = ++photoLoadId;
		photoPreparing = true;
		try {
			const prepared = await prepareImportImage(raw);
			if (loadId !== photoLoadId) return;

			photoFile = prepared.file;
			photoDimensions = { width: prepared.width, height: prepared.height };
			photoPreview = URL.createObjectURL(prepared.file);
			assignFile(photoInput, prepared.file);
		} catch (error) {
			if (loadId !== photoLoadId) return;
			photoFile = null;
			photoDimensions = null;
			photoPreview = null;
			photoError = error instanceof Error ? error.message : 'The photo could not be prepared.';
		} finally {
			if (loadId === photoLoadId) photoPreparing = false;
		}
	}

	function clearPhoto(): void {
		photoLoadId += 1;
		photoFile = null;
		photoDimensions = null;
		photoPreview = null;
		photoError = null;
		photoPreparing = false;
		usePhotoAsCover = false;
		if (photoInput) photoInput.value = '';
	}

	function onPhotoPicked(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) void loadPhoto(file);
		// Clear now so picking the same file again still fires `change`;
		// `loadPhoto` assigns the prepared JPEG back to the input.
		input.value = '';
	}

	function onPhotoDrop(event: DragEvent): void {
		event.preventDefault();
		photoDragging = false;
		if (importing) return;
		const file = event.dataTransfer?.files?.[0];
		if (file) void loadPhoto(file);
	}

	function onPhotoDragOver(event: DragEvent): void {
		event.preventDefault();
		if (!importing) photoDragging = true;
	}

	function handlePaste(event: ClipboardEvent): void {
		if (draft || sourceMode !== 'photo' || importing) return;

		const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
			entry.type.startsWith('image/')
		);
		const file = item?.getAsFile();
		if (!file) return;

		event.preventDefault();
		void loadPhoto(file);
	}

	function onSourceKeydown(event: KeyboardEvent, index: number): void {
		if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
		event.preventDefault();

		const step = event.key === 'ArrowRight' ? 1 : -1;
		const next = (index + step + sources.length) % sources.length;
		sourceMode = sources[next].id;

		const tabs = (
			event.currentTarget as HTMLElement
		).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		tabs?.[next]?.focus();
	}

	function handleCreate() {
		creating = true;
		createError = null;

		return async ({ result }: { result: ActionResult }) => {
			creating = false;

			if (result.type === 'redirect') {
				await goto(result.location);
				return;
			}

			if (result.type === 'failure') {
				createError = failureMessage(result.data);
				return;
			}

			if (result.type === 'error') {
				createError = result.error?.message ?? 'The recipe could not be created.';
			}
		};
	}

	/** Apply the inline title edit back into the Cooklang frontmatter. */
	function applyTitle(): void {
		const next = editedTitle.trim();

		if (!next) {
			editedTitle = lastAppliedTitle;
			return;
		}

		if (next === lastAppliedTitle) return;

		source = setFrontmatterTitle(source, next);
		if (!filenameDirty) filename = next;
		lastAppliedTitle = next;
	}

	// ------------------------------------------------------------- text edits

	function selectionRange(): { start: number; end: number } {
		return sourceEditor?.getSelection() ?? { start: source.length, end: source.length };
	}

	function setEditorText(
		next: string,
		selectionStart: number,
		selectionEnd = selectionStart
	): void {
		if (!sourceEditor) {
			source = next;
			return;
		}

		sourceEditor.setValue(next, selectionStart, selectionEnd);
	}

	async function replaceSelection(
		replacement: string,
		selectionStart = replacement.length,
		selectionEnd = selectionStart
	): Promise<void> {
		if (viewMode === 'preview') {
			viewMode = 'write';
			await tick();
		}

		const { start, end } = selectionRange();
		setEditorText(
			source.slice(0, start) + replacement + source.slice(end),
			start + selectionStart,
			start + selectionEnd
		);
	}

	function selectedText(): string {
		const { start, end } = selectionRange();
		return source.slice(start, end);
	}

	async function insertEntity(trigger: '@' | '#', placeholder: string): Promise<void> {
		const { start, end } = selectionRange();
		if (isInsideEntity(source, start, end)) return;

		const selected = selectedText()
			.trim()
			.replace(/^[@#~]\s*/u, '');
		const name = selected || placeholder;
		const replacement = `${trigger}${name}{}`;
		const selectStart = selected ? replacement.length - 1 : 1;
		const selectEnd = selected ? replacement.length - 1 : 1 + name.length;

		await replaceSelection(replacement, selectStart, selectEnd);
	}

	async function insertTimer(): Promise<void> {
		const { start, end } = selectionRange();
		if (isInsideEntity(source, start, end)) return;

		const selected = selectedText()
			.trim()
			.replace(/^[@#~]\s*/u, '');
		const replacement = `~${selected || 'timer'}{10%minutes}`;
		const selectStart = selected ? replacement.length - 11 : 1;
		const selectEnd = selected ? replacement.length - 1 : 6;

		await replaceSelection(replacement, selectStart, selectEnd);
	}

	async function insertSection(): Promise<void> {
		await replaceSelection('\n\n== Section ==\n\n', 5, 12);
	}

	async function insertBold(): Promise<void> {
		const selected = selectedText();
		if (selected) {
			await replaceSelection(`**${selected}**`, 2, 2 + selected.length);
		} else {
			await replaceSelection('**bold**', 2, 6);
		}
	}

	async function toggleComment(): Promise<void> {
		if (viewMode === 'preview') {
			viewMode = 'write';
			await tick();
		}

		const { start, end } = selectionRange();
		const lineStart = start === 0 ? 0 : source.lastIndexOf('\n', start - 1) + 1;
		const nextBreak = source.indexOf('\n', end);
		const lineEnd = nextBreak === -1 ? source.length : nextBreak;
		const block = source.slice(lineStart, lineEnd);
		const lines = block.split('\n');
		const meaningful = lines.filter((line) => line.trim() !== '');
		const allCommented =
			meaningful.length > 0 && meaningful.every((line) => line.trimStart().startsWith('--'));

		const nextBlock = lines
			.map((line) => {
				if (allCommented) return line.replace(/^(\s*)--\s?/u, '$1');
				return line.trim() === '' ? line : `-- ${line}`;
			})
			.join('\n');

		setEditorText(
			source.slice(0, lineStart) + nextBlock + source.slice(lineEnd),
			lineStart,
			lineStart + nextBlock.length
		);
	}

	function undo(): void {
		sourceEditor?.undo();
	}

	function redo(): void {
		sourceEditor?.redo();
	}

	function toggleWrap(): void {
		wrap = !wrap;
	}

	async function requestPreview(value: string): Promise<void> {
		previewAbort?.abort();
		const controller = new AbortController();
		previewAbort = controller;
		previewLoading = true;

		try {
			const response = await fetch('/api/recipes/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: value,
					fallbackTitle: editedTitle || draft?.title || 'Imported recipe'
				}),
				signal: controller.signal
			});

			const body = (await response.json().catch(() => null)) as
				RecipePreview | { message?: unknown; line?: unknown } | null;

			if (!response.ok) {
				if (controller.signal.aborted) return;
				const failure = body as { message?: unknown; line?: unknown } | null;
				previewError = {
					message: typeof failure?.message === 'string' ? failure.message : 'Preview failed',
					line: typeof failure?.line === 'number' ? failure.line : null
				};
				return;
			}

			if (controller.signal.aborted) return;

			preview = body as RecipePreview;
			lastPreviewed = value;
			previewError = null;
		} catch (error) {
			if (controller.signal.aborted) return;
			previewError = {
				message: error instanceof Error ? error.message : 'Preview failed',
				line: null
			};
		} finally {
			if (previewAbort === controller) {
				previewLoading = false;
				previewAbort = null;
			}
		}
	}

	$effect(() => {
		const next = editedTitle.trim();
		if (!next || filenameDirty) return;

		// File Name follows Title until the user edits it themselves.
		filename = next;
	});

	$effect(() => {
		void (editedTitle || 'Recipe title');
		const measure = titleMeasure;
		if (!measure) return;

		// 46px covers the horizontal padding, border and pencil affordance.
		titleWidth = Math.max(96, Math.ceil(measure.getBoundingClientRect().width) + 46);
	});

	$effect(() => {
		if (previewError) panelOpen = true;
	});

	$effect(() => {
		const value = source;

		if (!draft || value === lastPreviewed) return;

		if (previewTimer) clearTimeout(previewTimer);

		previewTimer = setTimeout(() => {
			previewTimer = null;
			void requestPreview(value);
		}, 450);

		return () => {
			if (previewTimer) {
				clearTimeout(previewTimer);
				previewTimer = null;
			}
		};
	});

	// Object URLs are only needed for the life of each prepared photo.
	$effect(() => {
		const url = photoPreview;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	// A failed import re-renders the photo form, which discards its file input.
	// Put the already prepared file back so the user can simply try again.
	$effect(() => {
		const input = photoInput;
		const file = photoFile;
		if (!input || !file) return;
		if (!input.files || input.files.length === 0) assignFile(input, file);
	});

	// Keep the review form's hidden file input in sync with the photo the user
	// chose, so Save sends the cover without asking for the file twice.
	$effect(() => {
		const input = coverInput;
		const file = photoFile;
		const shouldUse = usePhotoAsCover && draft?.sourceKind === 'photo';
		if (!input) return;

		if (file && shouldUse) {
			assignFile(input, file);
		} else {
			input.value = '';
		}
	});
</script>

<svelte:window onpaste={handlePaste} />

{#snippet importLog()}
	{#if draft}
		<ul class="divide-border divide-y">
			{#each importLogEntries as entry, index (index)}
				{@const Icon =
					entry.tone === 'success'
						? CircleCheckIcon
						: entry.tone === 'warning'
							? TriangleAlertIcon
							: InfoIcon}
				<li class="flex items-start gap-2 px-3 py-1.5 text-xs">
					<Icon class="mt-0.5 size-3.5 shrink-0 {logToneClass(entry.tone)}" />
					<div class="min-w-0">
						<p class="text-fg">{entry.message}</p>
						{#if entry.detail}
							<p class="text-fg-subtle mt-0.5 break-all">{entry.detail}</p>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<svelte:head>
	<title>Import recipe</title>
</svelte:head>

<Page full flush class="flex h-full min-h-0 flex-col">
	<div
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 md:border-l-0"
	>
		<header
			class="border-border flex shrink-0 flex-wrap items-center gap-3 border-b px-3 py-2 md:px-4"
		>
			<a
				href="/"
				class="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
			>
				<ArrowLeftIcon class="size-4" />
				Recipes
			</a>

			<span class="bg-border hidden h-5 w-px sm:block" aria-hidden="true"></span>

			<div class="min-w-0 flex-1">
				<div class="flex min-w-0 items-center gap-2">
					<h1 class="text-fg truncate text-base font-semibold">Import recipe</h1>
					{#if data.aiConfigured}
						<Badge tone="accent">{data.aiModel}</Badge>
					{/if}
					{#if data.visionConfigured && data.visionModel}
						<Badge tone="accent2">
							<CameraIcon class="size-3" />
							{data.visionModel}
						</Badge>
					{/if}
					{#if !anyConfigured}
						<Badge tone="warn">Not configured</Badge>
					{/if}
				</div>
				<p class="text-fg-subtle truncate text-xs">
					Turn a recipe page or a photo into Cooklang, then review it before saving.
				</p>
			</div>
		</header>

		{#if !draft}
			<div class="min-h-0 flex-1 overflow-y-auto">
				<div class="flex min-h-full items-center justify-center px-4 py-8 sm:px-6">
					<div class="w-full max-w-2xl">
						<div class="mb-3 flex items-center gap-2.5">
							<div
								class="bg-accent-soft text-accent-soft-fg inline-flex size-9 shrink-0 items-center justify-center rounded-full"
							>
								<SparklesIcon class="size-4" />
							</div>
							<div>
								<h2 class="text-fg text-lg font-semibold">Import a recipe</h2>
								<p class="text-fg-muted text-sm">Start from a recipe page or a picture of one.</p>
							</div>
						</div>

						<div class="border-border bg-surface overflow-hidden rounded-lg border">
							<div
								role="tablist"
								aria-label="Import source"
								class="border-border bg-surface-muted/40 flex items-center gap-1 border-b px-1"
							>
								{#each sources as source, index (source.id)}
									<button
										type="button"
										role="tab"
										id="import-source-{source.id}"
										aria-selected={sourceMode === source.id}
										aria-controls="import-panel"
										tabindex={sourceMode === source.id ? 0 : -1}
										disabled={importing}
										class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-100 disabled:opacity-60 {sourceMode ===
										source.id
											? 'text-fg border-accent'
											: 'text-fg-muted hover:text-fg border-transparent'}"
										onclick={() => (sourceMode = source.id)}
										onkeydown={(event) => onSourceKeydown(event, index)}
									>
										<source.icon class="size-4" />
										{source.label}
										{#if source.id === 'photo' && !data.visionConfigured}
											<span
												class="bg-warn-soft text-warn-soft-fg rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
											>
												setup
											</span>
										{/if}
									</button>
								{/each}
							</div>

							<div
								id="import-panel"
								role="tabpanel"
								aria-labelledby="import-source-{sourceMode}"
								class="p-5 sm:p-6"
							>
								{#if importing}
									<AiThinking
										model={importKind === 'photo'
											? (data.visionModel ?? data.aiModel)
											: data.aiModel}
										kind={importKind}
									/>
								{:else if sourceMode === 'url'}
									<p class="text-fg-muted text-sm">
										Paste a recipe page. The server fetches it, extracts the recipe data, and asks
										{data.aiModel} to turn it into Cooklang. Ingredient names from your library are offered
										to the model so it can reuse them instead of adding near-duplicates.
									</p>

									{#if !data.aiConfigured}
										<div
											class="border-warn-soft bg-warn-soft/40 text-warn-soft-fg mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
											role="alert"
										>
											<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
											<div>
												<p class="font-medium">AI import is not configured.</p>
												<p class="mt-0.5">
													Set <code class="font-mono text-xs">AI_API_KEY</code> in the environment
													(and optionally <code class="font-mono text-xs">AI_BASE_URL</code> and
													<code class="font-mono text-xs">AI_MODEL</code>), then restart the app.
												</p>
											</div>
										</div>
									{/if}

									<form
										method="POST"
										action="?/import"
										use:enhance={handleImport('url')}
										class="mt-5 space-y-2"
									>
										<label for="import-url" class="text-fg block text-sm font-medium"
											>Recipe URL</label
										>
										<div class="flex flex-col gap-2 sm:flex-row">
											<div class="relative min-w-0 flex-1">
												<GlobeIcon
													class="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
												/>
												<input
													id="import-url"
													name="url"
													type="url"
													class="field pl-9"
													placeholder="https://www.chefkoch.de/rezepte/…"
													bind:value={url}
													required
													disabled={!data.aiConfigured}
												/>
											</div>
											<Button type="submit" disabled={!data.aiConfigured || !url.trim()}>
												<SparklesIcon class="size-4" />
												Import
											</Button>
										</div>
										<p class="text-fg-subtle text-xs">
											The page is fetched once, on this server. Large pages are rejected, and
											private or local addresses are blocked.
										</p>
									</form>
								{:else}
									<p class="text-fg-muted text-sm">
										Take or choose a picture of a cookbook page, handwritten card, screenshot, or a
										dish with the recipe in its caption. {data.visionModel ?? 'A vision model'} reads
										the visible text and turns it into Cooklang, reusing ingredient names from your library.
									</p>

									{#if !data.visionConfigured}
										<div
											class="border-warn-soft bg-warn-soft/40 text-warn-soft-fg mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
											role="alert"
										>
											<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
											<div>
												<p class="font-medium">Photo import is not configured.</p>
												<p class="mt-0.5">
													Set <code class="font-mono text-xs">AI_VISION_MODEL</code> to a
													vision-capable model (and
													<code class="font-mono text-xs">AI_VISION_BASE_URL</code>
													/
													<code class="font-mono text-xs">AI_VISION_API_KEY</code> if it is not the text
													provider), then restart the app.
												</p>
											</div>
										</div>
									{/if}

									<form
										method="POST"
										action="?/importPhoto"
										enctype="multipart/form-data"
										use:enhance={handleImport('photo')}
										class="mt-5 space-y-3"
									>
										<input
											bind:this={photoInput}
											type="file"
											name="image"
											accept={IMAGE_ACCEPT}
											class="sr-only"
											aria-label="Choose a recipe photo"
											onchange={onPhotoPicked}
											disabled={!data.visionConfigured}
										/>

										{#if photoPreparing}
											<div
												class="border-border bg-surface-muted/30 flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center"
												role="status"
												aria-live="polite"
											>
												<LoaderCircleIcon class="text-accent size-7 animate-spin" />
												<p class="text-fg-muted text-sm">Preparing the photo…</p>
											</div>
										{:else if photoFile && photoPreview}
											<div
												class="border-border flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
											>
												<img
													src={photoPreview}
													alt="Selected recipe"
													class="border-border h-28 w-full rounded-md border object-cover sm:w-36"
												/>
												<div class="min-w-0 flex-1">
													<p class="text-fg truncate text-sm font-medium">{photoFile.name}</p>
													<p class="text-fg-subtle mt-0.5 text-xs">
														{#if photoDimensions}
															{photoDimensions.width} × {photoDimensions.height} px ·
														{/if}
														{formatBytes(photoFile.size)}
													</p>
													<div class="mt-2 flex flex-wrap gap-2">
														<Button
															type="button"
															variant="outline"
															size="sm"
															onclick={() => photoInput?.click()}
														>
															Choose another
														</Button>
														<Button type="button" variant="ghost" size="sm" onclick={clearPhoto}>
															<Trash2Icon class="size-4" />
															Remove
														</Button>
													</div>
												</div>
											</div>

											<div class="flex items-start gap-2.5">
												<Toggle
													bind:checked={usePhotoAsCover}
													label="Use this photo as the recipe cover"
												/>
												<div class="min-w-0">
													<p class="text-fg text-sm">Use this photo as the recipe cover</p>
													<p class="text-fg-subtle text-xs">
														Best when the picture shows the dish. Leave it off for a cookbook page.
													</p>
												</div>
											</div>

											<Button
												type="submit"
												disabled={!data.visionConfigured || !photoFile || photoPreparing}
											>
												<SparklesIcon class="size-4" />
												Read recipe
											</Button>
										{:else}
											<button
												type="button"
												class="flex min-h-44 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors duration-150 disabled:opacity-60 {photoDragging
													? 'border-accent bg-accent-soft/30'
													: 'border-border bg-surface-muted/30 hover:border-accent hover:bg-accent-soft/20'}"
												onclick={() => photoInput?.click()}
												ondragover={onPhotoDragOver}
												ondragleave={() => (photoDragging = false)}
												ondrop={onPhotoDrop}
												disabled={!data.visionConfigured}
											>
												<ImagePlusIcon class="text-fg-subtle mb-2 size-8" aria-hidden="true" />
												<span class="text-fg block text-sm font-medium">
													Choose a photo or drop it here
												</span>
												<span class="text-fg-subtle mt-1 block text-xs">
													or paste one from the clipboard · JPEG, PNG, WebP or HEIC
												</span>
											</button>
										{/if}

										<p class="text-fg-subtle text-xs">
											The photo is downscaled in your browser and read once by the model. Nothing is
											saved until you choose Create recipe.
										</p>

										{#if photoError}
											<div
												class="border-danger/30 bg-danger-soft text-danger-soft-fg flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
												role="alert"
											>
												<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
												<p class="min-w-0 flex-1">{photoError}</p>
											</div>
										{/if}
									</form>
								{/if}

								{#if importError}
									<div
										class="border-danger/30 bg-danger-soft text-danger-soft-fg mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
										role="alert"
									>
										<TriangleAlertIcon class="mt-0.5 size-4 shrink-0" />
										<p class="min-w-0 flex-1">{importError}</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="border-border flex shrink-0 flex-wrap items-end gap-2 border-b px-3 py-2 md:px-4">
				<form
					bind:this={formEl}
					method="POST"
					action="?/create"
					enctype="multipart/form-data"
					use:enhance={handleCreate}
					class="flex min-w-0 flex-1 flex-wrap items-end gap-2"
				>
					<input type="hidden" name="source" value={source} />
					<input type="hidden" name="imageUrl" value={draft.imageUrl ?? ''} />
					<input
						bind:this={coverInput}
						type="file"
						name="coverImage"
						accept={IMAGE_ACCEPT}
						class="sr-only"
						tabindex="-1"
						aria-hidden="true"
					/>

					<label class="text-fg-muted flex flex-col gap-1 text-xs">
						Title
						<div class="relative max-w-full min-w-0">
							<span
								bind:this={titleMeasure}
								class="invisible absolute top-0 left-0 text-sm font-semibold whitespace-pre"
								aria-hidden="true">{editedTitle || 'Recipe title'}</span
							>
							<input
								name="title"
								class="field h-8 max-w-full min-w-0 py-1 pr-8 pl-2 text-sm font-semibold"
								style="width: {titleWidth}px"
								bind:value={editedTitle}
								onblur={applyTitle}
								onkeydown={(event) => {
									if (event.key === 'Enter') {
										event.preventDefault();
										event.currentTarget.blur();
									}
								}}
								aria-label="Recipe title"
								title="Click to edit the recipe title"
								disabled={creating}
							/>
							<PencilIcon
								class="text-fg-subtle pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2"
							/>
						</div>
					</label>

					<div class="ml-auto flex flex-wrap items-end gap-2">
						{#if draft.sourceKind === 'photo' && photoFile}
							<div class="text-fg-muted flex items-center gap-2 pb-1 text-xs">
								<Toggle bind:checked={usePhotoAsCover} label="Use the photo as the recipe cover" />
								Photo as cover
							</div>
						{/if}

						<label class="text-fg-muted flex flex-col gap-1 text-xs">
							Folder
							<input
								name="folder"
								class="field h-8 w-36 py-1 text-xs"
								list="import-folders"
								placeholder="optional"
								bind:value={folder}
								disabled={creating}
							/>
						</label>

						<label class="text-fg-muted flex flex-col gap-1 text-xs">
							File name
							<input
								name="filename"
								class="field h-8 w-80 py-1 text-xs"
								bind:value={filename}
								oninput={() => (filenameDirty = true)}
								disabled={creating}
							/>
						</label>

						<datalist id="import-folders">
							{#each data.folders as existingFolder (existingFolder)}
								<option value={existingFolder}></option>
							{/each}
						</datalist>

						<Button type="submit" size="sm" loading={creating} disabled={creating}>
							{#if !creating}
								<SaveIcon class="size-4" />
							{/if}
							Save
						</Button>
					</div>
				</form>
			</div>

			{#if createError}
				<div
					class="border-danger/30 bg-danger-soft text-danger-soft-fg flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm md:px-4"
					role="alert"
				>
					<TriangleAlertIcon class="size-4 shrink-0" />
					<p class="min-w-0 flex-1">{createError}</p>
				</div>
			{/if}

			<CooklangToolbar
				canUndo={cmHistory.undo > 0}
				canRedo={cmHistory.redo > 0}
				{wrap}
				{viewMode}
				onundo={undo}
				onredo={redo}
				oninsertingredient={() => insertEntity('@', 'ingredient')}
				oninsertcookware={() => insertEntity('#', 'cookware')}
				oninserttimer={insertTimer}
				oninsertsection={insertSection}
				ontogglecomment={toggleComment}
				onbold={insertBold}
				onopencheatsheet={() => (cheatsheetOpen = true)}
				ontogglewrap={toggleWrap}
				onviewmode={(mode) => (viewMode = mode)}
			/>

			<div
				class="grid min-h-0 flex-1 {viewMode === 'split'
					? 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1'
					: 'grid-cols-1'}"
			>
				<div
					class="flex min-h-0 min-w-0 flex-col {viewMode === 'split'
						? 'border-border border-b lg:border-r lg:border-b-0'
						: ''}"
					class:hidden={viewMode === 'preview'}
				>
					<div class="border-border flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
						<h2 class="text-fg text-xs font-semibold">Cooklang</h2>
						<span class="text-fg-subtle ml-auto text-xs tabular-nums">
							{source.length} characters
						</span>
					</div>

					<div class="min-h-0 flex-1 overflow-hidden">
						<CooklangCodeMirror
							value={source}
							{terms}
							{wrap}
							{diagnostics}
							onvalue={(next) => (source = next)}
							oncaret={() => {}}
							onhistory={(state) => (cmHistory = state)}
							onsave={() => formEl?.requestSubmit()}
							onbold={() => void insertBold()}
							oncomment={() => void toggleComment()}
							ontoggleconsole={() => (panelOpen = !panelOpen)}
							onready={(handle) => (sourceEditor = handle)}
						/>
					</div>
				</div>

				{#if viewMode !== 'write'}
					<section
						class="flex min-h-0 min-w-0 flex-col {viewMode === 'split'
							? 'border-border border-t lg:border-t-0 lg:border-l'
							: ''}"
						aria-label="Recipe preview"
					>
						<div class="border-border flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
							<h2 class="text-fg text-xs font-semibold">Preview</h2>
							{#if previewLoading}
								<LoaderCircleIcon class="text-fg-subtle size-3.5 animate-spin" />
								<span class="sr-only">Updating preview</span>
							{/if}
						</div>

						<div class="min-h-0 flex-1 overflow-y-auto">
							{#if preview}
								<CooklangPreview {preview} loading={previewLoading} />
							{:else}
								<p class="text-fg-subtle p-4 text-sm">Nothing to preview yet.</p>
							{/if}
						</div>
					</section>
				{/if}
			</div>

			<ProblemsPanel
				bind:open={panelOpen}
				{diagnostics}
				loading={previewLoading}
				details={importLog}
				detailsLabel="Import"
				additionalProblemCount={importProblemCount}
				detailsProblemCount={importProblemCount}
			/>
		{/if}
	</div>
</Page>

<Drawer bind:open={cheatsheetOpen} title="Cooklang syntax" side="right">
	<CooklangCheatsheet />
</Drawer>
