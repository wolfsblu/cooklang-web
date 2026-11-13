<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		ArrowLeftIcon,
		BoldIcon,
		BookOpenIcon,
		BracesIcon,
		CarrotIcon,
		ChevronDownIcon,
		ChevronUpIcon,
		CircleCheckIcon,
		CircleHelpIcon,
		Columns2Icon,
		CookingPotIcon,
		EyeIcon,
		LoaderCircleIcon,
		MessageSquareIcon,
		Redo2Icon,
		SaveIcon,
		SquarePenIcon,
		TimerIcon,
		TriangleAlertIcon,
		Undo2Icon
	} from '@lucide/svelte';
	import { onMount, tick, untrack } from 'svelte';
	import type {
		CompletionTerm,
		EditorVocabulary,
		RecipeDiagnostic,
		RecipePreview
	} from '$lib/types/editor';
	import {
		applyCompletion,
		detectCompletionContext,
		isInsideEntity,
		mergeCompletionTerms,
		rankCompletions,
		type CompletionContext
	} from '$lib/utils/cooklang-completion';
	import { highlightCooklang, type CooklangTokenKind } from '$lib/utils/cooklang-highlight';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import CompletionMenu from './CompletionMenu.svelte';
	import CooklangCheatsheet from './CooklangCheatsheet.svelte';
	import CooklangPreview from './CooklangPreview.svelte';

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

	// The component takes a snapshot of the server data and owns it from then
	// on. `untrack` makes that explicit: typing must not be overwritten when
	// SvelteKit re-runs the load function after a form action.
	let text = $state(untrack(() => source));
	let savedText = $state(untrack(() => source));
	let expectedMtime = $state(untrack(() => mtimeMs));
	let textarea = $state<HTMLTextAreaElement | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);
	let scrollTop = $state(0);
	let scrollLeft = $state(0);
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
	let lastPreviewed = $state(untrack(() => source));
	let previewTimer: ReturnType<typeof setTimeout> | null = null;
	let previewAbort: AbortController | null = null;

	// View and aux panels
	let viewMode = $state<ViewMode>('split');
	let cheatsheetOpen = $state(false);
	let leaveOpen = $state(false);
	let consoleOpen = $state(untrack(() => preview.diagnostics.length > 0));
	let pendingNavigation: string | null = null;
	let allowLeave = false;

	// Autocomplete
	let completion = $state<CompletionContext | null>(null);
	let completionItems = $state<CompletionTerm[]>([]);
	let activeCompletion = $state(0);
	let menuPosition = $state<{ left: number; top: number; width: number } | null>(null);

	// Undo history. Native textarea undo cannot see programmatic toolbar and
	// completion edits, so the editor keeps one history for both.
	interface Snapshot {
		text: string;
		caret: number;
	}
	let history = $state<Snapshot[]>([{ text: untrack(() => source), caret: 0 }]);
	let historyIndex = $state(0);
	let historyTimer: ReturnType<typeof setTimeout> | null = null;
	let lastToolbarActionAt = 0;

	const dirty = $derived(text !== savedText);
	const tokens = $derived(highlightCooklang(text));
	const lineCount = $derived(text.split('\n').length);
	const lineNumbers = $derived(Array.from({ length: lineCount }, (_, index) => index + 1));
	const wordCount = $derived((text.trim().match(/\S+/gu) ?? []).length);
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
	const problemCount = $derived(
		previewError
			? 1
			: currentPreview.diagnostics.filter((diagnostic) => diagnostic.severity !== 'help').length
	);
	const canUndo = $derived(historyIndex > 0 || text !== (history[0]?.text ?? ''));
	const canRedo = $derived(historyIndex < history.length - 1);
	const menuOpen = $derived(
		completion !== null && menuPosition !== null && completionItems.length > 0
	);

	const TOKEN_CLASSES: Record<CooklangTokenKind, string> = {
		text: '',
		comment: 'text-fg-subtle italic',
		section: 'text-fg font-semibold',
		'metadata-key': 'text-accent2 font-medium',
		'metadata-value': 'text-fg-muted',
		frontmatter: 'text-fg-muted',
		'frontmatter-key': 'text-accent2 font-medium',
		'frontmatter-delimiter': 'text-fg-subtle',
		ingredient: 'text-accent font-semibold',
		'ingredient-quantity': 'text-accent/75',
		cookware: 'text-accent2 font-semibold',
		'cookware-quantity': 'text-accent2/75',
		timer: 'text-warn-soft-fg font-semibold',
		'timer-quantity': 'text-warn-soft-fg/80',
		note: 'text-fg-subtle italic'
	};

	const statusLabel = $derived(
		saving ? 'Saving…' : saveError ? 'Not saved' : dirty ? 'Unsaved changes' : 'Up to date'
	);

	function diagnosticClass(severity: RecipeDiagnostic['severity']): string {
		if (severity === 'error') return 'text-danger';
		if (severity === 'warning') return 'text-warn-soft-fg';
		return 'text-fg-subtle';
	}

	function diagnosticIcon(severity: RecipeDiagnostic['severity']) {
		return severity === 'help' ? CircleHelpIcon : TriangleAlertIcon;
	}

	// ---------------------------------------------------------------- history

	function commitHistory(value = text, caret = textarea?.selectionStart ?? value.length): void {
		if (history[historyIndex]?.text === value) return;

		if (historyIndex < history.length - 1) {
			history = history.slice(0, historyIndex + 1);
		}

		history = [...history, { text: value, caret }].slice(-200);
		historyIndex = history.length - 1;
	}

	function scheduleHistory(): void {
		if (historyTimer) clearTimeout(historyTimer);
		historyTimer = setTimeout(() => {
			historyTimer = null;
			commitHistory();
		}, 500);
	}

	async function applySnapshot(snapshot: Snapshot): Promise<void> {
		text = snapshot.text;
		closeCompletion();

		await tick();
		textarea?.focus();
		textarea?.setSelectionRange(snapshot.caret, snapshot.caret);
		updateCaret();
	}

	async function undo(): Promise<void> {
		if (historyTimer) {
			clearTimeout(historyTimer);
			historyTimer = null;
		}

		commitHistory();

		if (historyIndex > 0) {
			historyIndex--;
			await applySnapshot(history[historyIndex]);
		}
	}

	async function redo(): Promise<void> {
		if (historyTimer) {
			clearTimeout(historyTimer);
			historyTimer = null;
		}

		// A fresh edit after undo starts a new branch and discards the redo tail.
		if (text !== history[historyIndex]?.text) {
			commitHistory();
			return;
		}

		if (historyIndex < history.length - 1) {
			historyIndex++;
			await applySnapshot(history[historyIndex]);
		}
	}

	// ------------------------------------------------------------- text edits

	async function setEditorText(
		next: string,
		selectionStart: number,
		selectionEnd = selectionStart
	): Promise<void> {
		if (historyTimer) {
			clearTimeout(historyTimer);
			historyTimer = null;
		}

		text = next;
		commitHistory(next, selectionStart);
		closeCompletion();

		// Update the textarea immediately as well as the bound value. Toolbar
		// actions are async because of `tick`, and a second click arriving in
		// that gap would otherwise calculate its range against stale DOM text.
		const element = textarea;
		if (element) {
			element.value = next;
			element.focus();
			element.setSelectionRange(selectionStart, selectionEnd);
		}

		await tick();
		element?.focus();
		element?.setSelectionRange(selectionStart, selectionEnd);
		updateCaret();
	}

	async function replaceSelection(
		replacement: string,
		selectionStart = replacement.length,
		selectionEnd = selectionStart
	): Promise<void> {
		if (!textarea) {
			// Toolbar insertion from preview-only mode: show the editor first,
			// then use the caret position it remembered.
			viewMode = 'write';
			await tick();
		}

		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		await setEditorText(
			text.slice(0, start) + replacement + text.slice(end),
			start + selectionStart,
			start + selectionEnd
		);
	}

	function selectedText(): string {
		if (!textarea) return '';
		return text.slice(textarea.selectionStart, textarea.selectionEnd);
	}

	/**
	 * Run a toolbar insertion, ignoring the second click of a double click.
	 *
	 * Without this, each click runs its own async edit. The second click sees
	 * the placeholder selected by the first and wraps it, producing nonsense
	 * such as `@@ingredient{}{}`.
	 */
	function toolbarAction(action: () => void | Promise<void>): void {
		const now = performance.now();
		if (now - lastToolbarActionAt < 300) return;
		lastToolbarActionAt = now;
		void action();
	}

	async function insertEntity(trigger: '@' | '#', placeholder: string): Promise<void> {
		if (textarea && isInsideEntity(text, textarea.selectionStart, textarea.selectionEnd)) {
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
		if (textarea && isInsideEntity(text, textarea.selectionStart, textarea.selectionEnd)) {
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
		if (!textarea) {
			viewMode = 'write';
			await tick();
		}

		if (!textarea) return;

		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
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

		await setEditorText(
			text.slice(0, lineStart) + nextBlock + text.slice(lineEnd),
			lineStart,
			lineStart + nextBlock.length
		);
	}

	// -------------------------------------------------------------- autocomplete

	function closeCompletion(): void {
		completion = null;
		completionItems = [];
		menuPosition = null;
	}

	/** Viewport coordinates of a caret offset, using a hidden mirror element. */
	function caretCoordinates(element: HTMLTextAreaElement, position: number) {
		const mirror = document.createElement('div');
		const computed = window.getComputedStyle(element);

		const copied = [
			'boxSizing',
			'width',
			'height',
			'overflowX',
			'overflowY',
			'borderTopWidth',
			'borderRightWidth',
			'borderBottomWidth',
			'borderLeftWidth',
			'borderStyle',
			'paddingTop',
			'paddingRight',
			'paddingBottom',
			'paddingLeft',
			'fontStyle',
			'fontVariant',
			'fontWeight',
			'fontStretch',
			'fontSize',
			'fontFamily',
			'lineHeight',
			'letterSpacing',
			'textAlign',
			'textTransform',
			'textIndent',
			'textDecoration',
			'wordSpacing',
			'tabSize'
		] as const;

		mirror.style.position = 'absolute';
		mirror.style.visibility = 'hidden';
		mirror.style.top = '0';
		mirror.style.left = '-9999px';
		mirror.style.whiteSpace = 'pre';
		mirror.style.overflow = 'hidden';

		for (const property of copied) {
			mirror.style[property] = computed[property];
		}

		mirror.textContent = element.value.slice(0, position);

		const marker = document.createElement('span');
		marker.textContent = element.value.slice(position) || '.';
		mirror.appendChild(marker);
		document.body.appendChild(mirror);

		const rect = element.getBoundingClientRect();
		const coordinates = {
			left: rect.left + marker.offsetLeft - element.scrollLeft,
			top: rect.top + marker.offsetTop - element.scrollTop
		};

		document.body.removeChild(mirror);
		return coordinates;
	}

	function updateMenuPosition(): void {
		if (!completion || !textarea) {
			menuPosition = null;
			return;
		}

		const coordinates = caretCoordinates(textarea, completion.end);
		const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
		const width = 288;
		const estimatedHeight = Math.min(280, 38 + completionItems.length * 34);

		let top = coordinates.top + lineHeight + 4;
		if (top + estimatedHeight > window.innerHeight - 8) {
			top = Math.max(8, coordinates.top - estimatedHeight - 4);
		}

		menuPosition = {
			left: Math.max(8, Math.min(coordinates.left, window.innerWidth - width - 8)),
			top,
			width
		};
	}

	function refreshCompletion(): void {
		if (!textarea) {
			closeCompletion();
			return;
		}

		const context = detectCompletionContext(text, textarea.selectionStart);
		if (!context) {
			closeCompletion();
			return;
		}

		const localNames =
			context.kind === 'ingredient'
				? currentPreview.display.ingredients.map((ingredient) => ingredient.name)
				: currentPreview.display.cookware.map((item) => item.name);

		const base = context.kind === 'ingredient' ? vocabulary.ingredients : vocabulary.cookware;
		const terms = mergeCompletionTerms(base, localNames);

		completion = context;
		completionItems = rankCompletions(terms, context.query, 9);
		activeCompletion = 0;
		updateMenuPosition();
	}

	async function applySelectedCompletion(term: CompletionTerm): Promise<void> {
		if (!completion) return;

		const result = applyCompletion(text, completion, term.name);
		await setEditorText(result.source, result.caret);
	}

	function moveCompletion(delta: number): void {
		if (completionItems.length === 0) return;
		activeCompletion = (activeCompletion + delta + completionItems.length) % completionItems.length;
	}

	// --------------------------------------------------------------- textarea

	function updateCaret(): void {
		if (!textarea) return;

		const before = text.slice(0, textarea.selectionStart);
		const lines = before.split('\n');
		caretLine = lines.length;
		caretColumn = (lines[lines.length - 1]?.length ?? 0) + 1;
	}

	function handleInput(): void {
		updateCaret();
		refreshCompletion();
		scheduleHistory();
	}

	function handleScroll(event: Event): void {
		const element = event.currentTarget as HTMLTextAreaElement;
		scrollTop = element.scrollTop;
		scrollLeft = element.scrollLeft;

		if (menuOpen) updateMenuPosition();
	}

	function handleKeydown(event: KeyboardEvent): void {
		const modifier = event.metaKey || event.ctrlKey;

		if (modifier && event.key.toLowerCase() === 's') {
			event.preventDefault();
			void save();
			return;
		}

		if (modifier && event.key === ' ') {
			event.preventDefault();
			refreshCompletion();
			return;
		}

		if (modifier && event.key.toLowerCase() === 'b') {
			event.preventDefault();
			void insertBold();
			return;
		}

		if (modifier && event.key === '/') {
			event.preventDefault();
			void toggleComment();
			return;
		}

		if (modifier && event.shiftKey && event.key.toLowerCase() === 'm') {
			event.preventDefault();
			consoleOpen = !consoleOpen;
			return;
		}

		if (modifier && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) void redo();
			else void undo();
			return;
		}

		if (modifier && event.key.toLowerCase() === 'y') {
			event.preventDefault();
			void redo();
			return;
		}

		if (menuOpen && completion) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				moveCompletion(1);
				return;
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				moveCompletion(-1);
				return;
			}

			if (event.key === 'Enter' || event.key === 'Tab') {
				event.preventDefault();
				const term = completionItems[activeCompletion];
				if (term) void applySelectedCompletion(term);
				return;
			}
		}

		if (event.key === 'Escape' && completion) {
			event.preventDefault();
			closeCompletion();
			return;
		}

		if (event.key === 'Tab' && !event.shiftKey) {
			event.preventDefault();
			void replaceSelection('  ');
			return;
		}

		// `{` after an entity name closes itself, with the caret ready for a
		// quantity. The parser needs braces for multi-word names, and almost
		// every ingredient ends up with them anyway.
		if (event.key === '{' && !modifier && !event.altKey && textarea) {
			const before = text.slice(0, textarea.selectionStart);
			if (/[@#~][^\s{}]*$/u.test(before) && text[textarea.selectionStart] !== '}') {
				event.preventDefault();
				void replaceSelection('{}', 1);
				return;
			}
		}

		// Skip over the closing brace the editor inserted rather than adding a
		// second one.
		if (event.key === '}' && !modifier && !event.altKey && textarea) {
			if (text[textarea.selectionStart] === '}') {
				event.preventDefault();
				textarea.setSelectionRange(textarea.selectionStart + 1, textarea.selectionStart + 1);
				updateCaret();
			}
		}
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

				await tick();
				refreshCompletion();
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

	// Keep the active option visible when arrowing through the menu.
	$effect(() => {
		if (!menuOpen) return;
		document
			.getElementById(`completion-option-${activeCompletion}`)
			?.scrollIntoView({ block: 'nearest' });
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

		const resize = () => {
			if (menuOpen) updateMenuPosition();
		};

		window.addEventListener('resize', resize);
		return () => window.removeEventListener('resize', resize);
	});

	$effect(() => {
		const mode = viewMode;
		try {
			localStorage.setItem('cooklang-editor-view', mode);
		} catch {
			// Private browsing or a full quota; the editor still works.
		}
	});
</script>

<svelte:head>
	<title>Edit {currentPreview.display.title ?? title}</title>
</svelte:head>

<svelte:window onbeforeunload={handleBeforeUnload} />

<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
	<!-- Header -->
	<header class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
		<a
			href="/recipe/{slug}"
			class="text-fg-muted hover:text-fg inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-150"
		>
			<ArrowLeftIcon class="size-4" />
			Recipe
		</a>

		<div class="min-w-0">
			<div class="flex min-w-0 items-center gap-2">
				<h1 class="text-fg truncate text-lg font-semibold">
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

			<Button href="/recipe/{slug}" variant="outline" size="sm">
				<EyeIcon class="size-4" />
				View
			</Button>

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

		<!-- Toolbar -->
		<div
			class="border-border no-scrollbar flex shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b p-2 [&_button]:shrink-0"
		>
			<IconButton label="Undo" size="sm" variant="ghost" disabled={!canUndo} onclick={undo}>
				<Undo2Icon class="size-4" />
			</IconButton>
			<IconButton label="Redo" size="sm" variant="ghost" disabled={!canRedo} onclick={redo}>
				<Redo2Icon class="size-4" />
			</IconButton>

			<span class="bg-border mx-1 h-5 w-px" aria-hidden="true"></span>

			<Button
				type="button"
				variant="ghost"
				size="sm"
				onclick={() => toolbarAction(() => insertEntity('@', 'ingredient'))}
			>
				<CarrotIcon class="text-accent size-4" />
				Ingredient
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onclick={() => toolbarAction(() => insertEntity('#', 'cookware'))}
			>
				<CookingPotIcon class="text-accent2 size-4" />
				Cookware
			</Button>
			<Button type="button" variant="ghost" size="sm" onclick={() => toolbarAction(insertTimer)}>
				<TimerIcon class="text-warn-soft-fg size-4" />
				Timer
			</Button>

			<span class="bg-border mx-1 h-5 w-px" aria-hidden="true"></span>

			<Button type="button" variant="ghost" size="sm" onclick={() => toolbarAction(insertSection)}>
				<BracesIcon class="size-4" />
				Section
			</Button>
			<Button type="button" variant="ghost" size="sm" onclick={() => toolbarAction(toggleComment)}>
				<MessageSquareIcon class="size-4" />
				Comment
			</Button>
			<Button type="button" variant="ghost" size="sm" onclick={() => toolbarAction(insertBold)}>
				<BoldIcon class="size-4" />
				Bold
			</Button>

			<div class="ml-auto flex items-center gap-1">
				<IconButton
					label="Cooklang syntax reference"
					size="sm"
					onclick={() => (cheatsheetOpen = true)}
				>
					<BookOpenIcon class="size-4" />
				</IconButton>

				<span class="bg-border mx-1 h-5 w-px" aria-hidden="true"></span>

				<IconButton
					label="Write only"
					size="sm"
					variant={viewMode === 'write' ? 'soft' : 'ghost'}
					onclick={() => (viewMode = 'write')}
				>
					<SquarePenIcon class="size-4" />
				</IconButton>
				<IconButton
					label="Split editor and preview"
					size="sm"
					variant={viewMode === 'split' ? 'soft' : 'ghost'}
					onclick={() => (viewMode = 'split')}
				>
					<Columns2Icon class="size-4" />
				</IconButton>
				<IconButton
					label="Preview only"
					size="sm"
					variant={viewMode === 'preview' ? 'soft' : 'ghost'}
					onclick={() => (viewMode = 'preview')}
				>
					<EyeIcon class="size-4" />
				</IconButton>
			</div>
		</div>

		<!-- Editor and preview -->
		<div
			class="grid min-h-0 flex-1 {viewMode === 'split'
				? 'grid-rows-2 lg:grid-cols-2 lg:grid-rows-1'
				: 'grid-cols-1'}"
		>
			{#if viewMode !== 'preview'}
				<div class="flex min-h-0 min-w-0 flex-col">
					<div class="flex min-h-0 flex-1">
						<!-- Line numbers. They only align while the textarea does not
						     wrap, which is why the editor uses horizontal scrolling. -->
						<div
							class="bg-surface-muted border-border hidden w-12 shrink-0 overflow-hidden border-r sm:block"
							aria-hidden="true"
						>
							<div
								class="text-fg-subtle p-4 pr-2 text-right font-mono text-sm leading-6"
								style:transform="translateY(-{scrollTop}px)"
							>
								{#each lineNumbers as number (number)}
									<div>{number}</div>
								{/each}
							</div>
						</div>

						<div class="relative min-w-0 flex-1 overflow-hidden">
							<!-- The highlighted copy sits behind a transparent textarea. -->
							<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
								<pre
									class="absolute top-0 left-0 min-w-full p-4 font-mono text-sm leading-6 whitespace-pre"
									style:transform="translate({-scrollLeft}px, {-scrollTop}px)"><code
										>{#each tokens as token, index (index)}<span class={TOKEN_CLASSES[token.kind]}
												>{token.text}</span
											>{/each}</code
									></pre>
							</div>

							<textarea
								bind:this={textarea}
								bind:value={text}
								name="source"
								class="caret-fg selection:bg-accent/30 placeholder:text-fg-subtle absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent p-4 font-mono text-sm leading-6 whitespace-pre text-transparent outline-none"
								spellcheck="false"
								autocapitalize="off"
								wrap="off"
								placeholder="Write a Cooklang recipe…"
								aria-label="Recipe source"
								aria-autocomplete="list"
								oninput={handleInput}
								onkeydown={handleKeydown}
								onscroll={handleScroll}
								onclick={() => {
									updateCaret();
									closeCompletion();
								}}
								onblur={() => closeCompletion()}
							></textarea>
						</div>
					</div>
				</div>
			{/if}

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

		<!-- Problems console. The panel lives inside the workspace so it shrinks
		     the editor instead of pushing the page taller. -->
		<div class="border-border shrink-0 border-t">
			<button
				type="button"
				class="hover:bg-surface-muted flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100"
				onclick={() => (consoleOpen = !consoleOpen)}
				aria-expanded={consoleOpen}
				aria-controls="problems-console"
			>
				{#if problemCount > 0}
					<TriangleAlertIcon class="text-warn-soft-fg size-3.5 shrink-0" />
					<span class="text-fg text-xs font-medium">
						{problemCount}
						{problemCount === 1 ? 'problem' : 'problems'}
					</span>
				{:else}
					<CircleCheckIcon class="text-ok size-3.5 shrink-0" />
					<span class="text-fg text-xs font-medium">No syntax problems</span>
				{/if}

				{#if previewLoading}
					<span class="text-fg-subtle inline-flex items-center gap-1 text-xs">
						<LoaderCircleIcon class="size-3 animate-spin" />
						Checking…
					</span>
				{/if}

				<span class="text-fg-subtle ml-auto inline-flex items-center gap-1 text-xs">
					Problems
					{#if consoleOpen}
						<ChevronDownIcon class="size-3.5" />
					{:else}
						<ChevronUpIcon class="size-3.5" />
					{/if}
				</span>
			</button>

			{#if consoleOpen}
				<div id="problems-console" class="border-border max-h-48 overflow-y-auto border-t">
					{#if consoleDiagnostics.length > 0}
						<ul class="divide-border divide-y">
							{#each consoleDiagnostics as diagnostic, index (index)}
								{@const Icon = diagnosticIcon(diagnostic.severity)}
								<li class="flex items-start gap-2 px-3 py-1.5 text-xs">
									<Icon class="mt-0.5 size-3.5 shrink-0 {diagnosticClass(diagnostic.severity)}" />
									<div class="min-w-0">
										<p class="text-fg">{diagnostic.message}</p>
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

		<!-- Status bar -->
		<div
			class="border-border text-fg-subtle flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-1.5 text-xs"
		>
			<span>Ln {caretLine}, Col {caretColumn}</span>
			<span>{wordCount} words</span>
			<span>{stepCount} steps</span>
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

{#if menuOpen && completion && menuPosition}
	<CompletionMenu
		items={completionItems}
		activeIndex={activeCompletion}
		kind={completion.kind}
		position={menuPosition}
		onselect={applySelectedCompletion}
		onhover={(index) => (activeCompletion = index)}
	/>
{/if}

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
