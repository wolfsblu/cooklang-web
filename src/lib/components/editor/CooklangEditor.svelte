<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import type { ActionResult } from '$app/forms';
	import {
		ArrowLeftIcon,
		EyeIcon,
		LoaderCircleIcon,
		SaveIcon,
		TriangleAlertIcon
	} from '@lucide/svelte';
	import { onMount, tick, untrack } from 'svelte';
	import type { EditorVocabulary, RecipeDiagnostic, RecipePreview } from '#lib/types/editor.js';
	import { isInsideEntity, mergeCompletionTerms } from '#lib/utils/cooklang-completion.js';
	import { countLabel } from '#lib/utils/pluralize.js';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import Drawer from '#lib/components/ui/Drawer.svelte';
	import CooklangCheatsheet from './CooklangCheatsheet.svelte';
	import CooklangCodeMirror from './CooklangCodeMirror.svelte';
	import type { SourceEditorHandle } from './CooklangCodeMirror.svelte';
	import CooklangPreview from './CooklangPreview.svelte';
	import CooklangToolbar from './CooklangToolbar.svelte';
	import ProblemsPanel from './ProblemsPanel.svelte';

	interface Props {
		slug: string;
		relPath: string;
		title: string;
		source: string;
		mtimeMs: number;
		vocabulary: EditorVocabulary;
		preview: RecipePreview;
	}

	const { slug, relPath, title, source, mtimeMs, vocabulary, preview }: Props = $props();

	type ViewMode = 'write' | 'split' | 'preview';

	// The server reads the file verbatim, which on Windows may include CRLF.
	// CodeMirror normalizes line breaks internally, so the snapshot has to
	// match that: otherwise the editor opens already "dirty" and saving
	// silently rewrites every line ending.
	const initialSource = untrack(() => source).replace(/\r\n?/gu, '\n');

	// The component takes a snapshot of the server data and owns it from then
	// on. `untrack` makes that explicit: typing must not be overwritten when
	// SvelteKit re-runs the load function after a form action.
	let text = $state(initialSource);
	let savedText = $state(initialSource);
	let expectedMtime = $state(untrack(() => mtimeMs));
	let sourceEditor = $state<SourceEditorHandle | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);
	let caretLine = $state(1);
	let caretColumn = $state(1);

	// Save state
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let conflict = $state(false);
	let savedAt = $state<number | null>(null);

	interface PreviewError {
		message: string;
		line: number | null;
	}

	// Live preview
	let currentPreview = $state<RecipePreview>(untrack(() => preview));
	let previewLoading = $state(false);
	let previewError = $state<PreviewError | null>(null);
	let lastPreviewed = $state(initialSource);
	let previewTimer: ReturnType<typeof setTimeout> | null = null;
	let previewAbort: AbortController | null = null;

	// View and aux panels
	let viewMode = $state<ViewMode>('split');
	let wrap = $state(true);
	let cheatsheetOpen = $state(false);
	let leaveOpen = $state(false);
	let consoleOpen = $state(untrack(() => preview.diagnostics.length > 0));
	let pendingNavigation: string | null = null;
	let allowLeave = false;

	// CodeMirror owns undo history; the toolbar mirrors its depth.
	let cmHistory = $state({ undo: 0, redo: 0 });

	const dirty = $derived(text !== savedText);
	const wordCount = $derived((text.trim().match(/\S+/gu) ?? []).length);
	const completionTerms = $derived({
		ingredient: mergeCompletionTerms(
			vocabulary.ingredients,
			currentPreview.display.ingredients.map((ingredient) => ingredient.name)
		),
		cookware: mergeCompletionTerms(
			vocabulary.cookware,
			currentPreview.display.cookware.map((item) => item.name)
		)
	});
	const stepCount = $derived(
		currentPreview.display.sections.reduce(
			(total, section) => total + section.content.filter((item) => item.type === 'step').length,
			0
		)
	);
	// A preview request that failed leaves `currentPreview` as the last good
	// version, so its diagnostics describe older text. The console must show
	// the parse failure instead, or it would claim "No syntax problems" beside
	// a visible error.
	const consoleDiagnostics = $derived<RecipeDiagnostic[]>(
		previewError
			? [{ severity: 'error', message: previewError.message, line: previewError.line }]
			: currentPreview.diagnostics
	);
	const canUndo = $derived(cmHistory.undo > 0);
	const canRedo = $derived(cmHistory.redo > 0);

	const statusLabel = $derived(
		saving ? 'Saving…' : saveError ? 'Not saved' : dirty ? 'Unsaved changes' : 'Up to date'
	);

	// ------------------------------------------------------------- text edits

	function selectionRange(): { start: number; end: number } {
		return sourceEditor?.getSelection() ?? { start: text.length, end: text.length };
	}

	/**
	 * Replace the document and put the selection where the caller asked.
	 *
	 * CodeMirror reports the change synchronously, so `text` is up to date by
	 * the time this returns and the preview effect sees the new value.
	 */
	function setEditorText(
		next: string,
		selectionStart: number,
		selectionEnd = selectionStart
	): void {
		if (!sourceEditor) {
			text = next;
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
			text.slice(0, start) + replacement + text.slice(end),
			start + selectionStart,
			start + selectionEnd
		);
	}

	function selectedText(): string {
		const { start, end } = selectionRange();
		return text.slice(start, end);
	}

	async function insertEntity(trigger: '@' | '#', placeholder: string): Promise<void> {
		const { start, end } = selectionRange();
		if (isInsideEntity(text, start, end)) {
			return;
		}

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
		if (isInsideEntity(text, start, end)) {
			return;
		}

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
		const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
		const nextBreak = text.indexOf('\n', end);
		const lineEnd = nextBreak === -1 ? text.length : nextBreak;
		const block = text.slice(lineStart, lineEnd);
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
			text.slice(0, lineStart) + nextBlock + text.slice(lineEnd),
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

	// ------------------------------------------------------------------ saving

	async function save(): Promise<void> {
		if (saving || !dirty) return;
		formEl?.requestSubmit();
	}

	function handleEnhance() {
		saving = true;
		saveError = null;
		const submitted = text;

		return async ({ result }: { result: ActionResult }) => {
			saving = false;

			if (result.type === 'success') {
				const data = result.data as {
					success: boolean;
					mtimeMs: number;
				};

				savedText = submitted;
				expectedMtime = data.mtimeMs;
				savedAt = Date.now();
				conflict = false;
				previewError = null;
				return;
			}

			if (result.type === 'failure') {
				const data = result.data as { message?: string; conflict?: boolean } | undefined;
				saveError = data?.message ?? 'The recipe could not be saved.';
				conflict = Boolean(data?.conflict);
				return;
			}

			if (result.type === 'error') {
				saveError = result.error?.message ?? 'The recipe could not be saved.';
			}
		};
	}

	// ------------------------------------------------------------- live preview

	async function requestPreview(value: string): Promise<void> {
		previewAbort?.abort();
		const controller = new AbortController();
		previewAbort = controller;
		previewLoading = true;

		try {
			const response = await fetch('/api/recipes/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ source: value, fallbackTitle: title }),
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

			currentPreview = body as RecipePreview;
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
		const value = text;

		if (value === lastPreviewed) return;

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

	// A parse failure is important enough to surface even if the console was
	// previously collapsed.
	$effect(() => {
		if (previewError) consoleOpen = true;
	});

	// ----------------------------------------------------------------- leaving

	beforeNavigate(({ cancel, to }) => {
		if (!dirty || allowLeave || !to) return;

		cancel();
		pendingNavigation = to.url.href;
		leaveOpen = true;
	});

	function handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (!dirty || allowLeave) return;
		event.preventDefault();
		event.returnValue = '';
	}

	function discardChanges(): void {
		allowLeave = true;
		leaveOpen = false;
		const target = pendingNavigation;
		pendingNavigation = null;
		if (target) void goto(target);
	}

	onMount(() => {
		const stored = localStorage.getItem('cooklang-editor-view');
		if (stored === 'write' || stored === 'split' || stored === 'preview') {
			viewMode = stored;
		}

		const storedWrap = localStorage.getItem('cooklang-editor-wrap');
		if (storedWrap === 'on' || storedWrap === 'off') {
			wrap = storedWrap === 'on';
		}
	});

	$effect(() => {
		const mode = viewMode;
		try {
			localStorage.setItem('cooklang-editor-view', mode);
		} catch {
			// Private browsing or a full quota; the editor still works.
		}
	});

	$effect(() => {
		const wrapping = wrap;
		try {
			localStorage.setItem('cooklang-editor-wrap', wrapping ? 'on' : 'off');
		} catch {
			// Same as above: persistence is a convenience, not a requirement.
		}
	});
</script>

<svelte:head>
	<title>Edit {currentPreview.display.title ?? title}</title>
</svelte:head>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
	<!-- Header -->
	<header class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-4">
		<a
			href="/recipe/{slug}"
			class="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
		>
			<ArrowLeftIcon class="size-4" />
			Recipe
		</a>

		<span class="bg-border hidden h-5 w-px sm:block" aria-hidden="true"></span>

		<div class="min-w-0">
			<div class="flex min-w-0 items-center gap-2">
				<h1 class="text-fg truncate text-base font-semibold">
					{currentPreview.display.title ?? title}
				</h1>
				{#if dirty}
					<Badge tone="warn">Unsaved</Badge>
				{:else if savedAt}
					<Badge tone="ok">Saved</Badge>
				{/if}
			</div>
			<p class="text-fg-subtle truncate text-xs">{relPath}</p>
		</div>

		<div class="ml-auto flex flex-wrap items-center gap-2">
			<span class="text-fg-muted hidden text-sm sm:inline" aria-live="polite">{statusLabel}</span>

			<Button
				type="submit"
				form="recipe-editor-form"
				size="sm"
				loading={saving}
				disabled={!dirty || saving}
			>
				{#if !saving}
					<SaveIcon class="size-4" />
				{/if}
				Save
			</Button>
		</div>
	</header>

	{#if saveError}
		<div
			class="border-danger/30 bg-danger-soft text-danger-soft-fg mb-3 flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm"
			role="alert"
		>
			<TriangleAlertIcon class="size-4 shrink-0" />
			<p class="min-w-0 flex-1">{saveError}</p>
			{#if conflict}
				<Button size="sm" variant="dangerSoft" onclick={() => window.location.reload()}>
					Reload editor
				</Button>
			{/if}
		</div>
	{/if}

	<!--
		One bordered workspace: toolbar, editor, preview and status bar. The
		form wraps the whole thing so the save button in the page header can
		submit it with `form="recipe-editor-form"`.
	-->
	<form
		id="recipe-editor-form"
		bind:this={formEl}
		method="POST"
		action="?/save"
		use:enhance={handleEnhance}
		class="border-border bg-surface flex min-h-0 flex-1 flex-col overflow-hidden border md:border-l-0"
	>
		<input type="hidden" name="expectedMtime" value={expectedMtime} />
		<input type="hidden" name="source" value={text} />

		<CooklangToolbar
			{canUndo}
			{canRedo}
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

		<!-- Editor and preview -->
		<div
			class="grid min-h-0 flex-1 {viewMode === 'split'
				? 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1'
				: 'grid-cols-1'}"
		>
			<div class="flex min-h-0 min-w-0 flex-col" class:hidden={viewMode === 'preview'}>
				<CooklangCodeMirror
					value={text}
					terms={completionTerms}
					{wrap}
					diagnostics={consoleDiagnostics}
					onvalue={(next) => (text = next)}
					oncaret={(position) => {
						caretLine = position.line;
						caretColumn = position.column;
					}}
					onhistory={(state) => (cmHistory = state)}
					onsave={() => void save()}
					onbold={() => void insertBold()}
					oncomment={() => void toggleComment()}
					ontoggleconsole={() => (consoleOpen = !consoleOpen)}
					onready={(handle) => (sourceEditor = handle)}
				/>
			</div>

			{#if viewMode !== 'write'}
				<section
					class="flex min-h-0 min-w-0 flex-col {viewMode === 'split'
						? 'border-border border-t lg:border-t-0 lg:border-l'
						: ''}"
					aria-label="Live preview"
				>
					<div class="border-border flex shrink-0 items-center gap-2 border-b px-4 py-2">
						<EyeIcon class="text-fg-subtle size-4" />
						<h2 class="text-fg text-sm font-semibold">Preview</h2>
						{#if previewLoading}
							<LoaderCircleIcon class="text-fg-subtle ml-auto size-4 animate-spin" />
							<span class="sr-only">Updating preview</span>
						{/if}
					</div>

					<div class="min-h-0 flex-1 overflow-y-auto">
						<CooklangPreview preview={currentPreview} loading={previewLoading} />
					</div>
				</section>
			{/if}
		</div>

		<!-- The panel lives inside the workspace so it shrinks the editor
		     instead of pushing the page taller. -->
		<ProblemsPanel
			bind:open={consoleOpen}
			diagnostics={consoleDiagnostics}
			loading={previewLoading}
		/>

		<!-- Status bar -->
		<div
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5 text-xs"
		>
			<span>Ln {caretLine}, Col {caretColumn}</span>
			<span>{countLabel(wordCount, 'word')}</span>
			<span>{countLabel(stepCount, 'step')}</span>
			<span class="ml-auto hidden sm:inline">
				{#if dirty}
					Ctrl+S to save · Ctrl+Space for suggestions
				{:else}
					All changes saved
				{/if}
			</span>
		</div>
	</form>
</div>

<Drawer bind:open={cheatsheetOpen} title="Cooklang syntax" side="right">
	<CooklangCheatsheet />
</Drawer>

<ConfirmDialog
	bind:open={leaveOpen}
	title="Discard changes?"
	description="This recipe has unsaved changes. Leaving now will lose them."
	confirmLabel="Discard and leave"
	cancelLabel="Keep editing"
	destructive
	onconfirm={discardChanges}
/>
