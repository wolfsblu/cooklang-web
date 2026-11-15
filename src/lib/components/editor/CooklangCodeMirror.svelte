<script lang="ts">
	/**
	 * CodeMirror 6 wrapper for the recipe source editor.
	 *
	 * CodeMirror is imperative, so the component owns an `EditorView` and exposes
	 * the handful of operations the page's toolbar needs. Everything else — undo,
	 * completion, wrapping, line numbers — is configured as extensions here.
	 */

	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import {
		defaultKeymap,
		history,
		historyKeymap,
		redo,
		redoDepth,
		undo,
		undoDepth
	} from '@codemirror/commands';
	import { bracketMatching } from '@codemirror/language';
	import { setDiagnostics } from '@codemirror/lint';
	import {
		cooklangCompletionSource,
		cooklangDiagnostics,
		cooklangHighlighting,
		cooklangLanguage
	} from '#lib/utils/cooklang-codemirror.js';
	import type { CompletionVocabulary } from '#lib/utils/cooklang-codemirror.js';
	import type { RecipeDiagnostic } from '#lib/types/editor.js';
	import { searchKeymap } from '@codemirror/search';
	import { Compartment, EditorState } from '@codemirror/state';
	import {
		EditorView,
		highlightSpecialChars,
		keymap,
		lineNumbers,
		placeholder,
		scrollPastEnd
	} from '@codemirror/view';
	import { onMount } from 'svelte';

	interface Props {
		value: string;
		/** Ingredient and cookware names, merged with the open recipe's own. */
		terms: CompletionVocabulary;
		wrap: boolean;
		diagnostics: RecipeDiagnostic[];
		onvalue: (value: string) => void;
		oncaret: (position: { line: number; column: number }) => void;
		onhistory: (state: { undo: number; redo: number }) => void;
		onsave: () => void;
		onbold: () => void;
		oncomment: () => void;
		ontoggleconsole: () => void;
		onready?: (handle: SourceEditorHandle) => void;
	}

	export interface SourceEditorHandle {
		focus(): void;
		getSelection(): { start: number; end: number };
		setValue(value: string, selectionStart?: number, selectionEnd?: number): void;
		undo(): void;
		redo(): void;
	}

	const {
		value,
		terms,
		wrap,
		diagnostics,
		onvalue,
		oncaret,
		onhistory,
		onsave,
		onbold,
		oncomment,
		ontoggleconsole,
		onready
	}: Props = $props();

	let host = $state<HTMLElement | null>(null);
	let view: EditorView | null = null;
	let lastDiagnosticsKey = '';

	const wrapCompartment = new Compartment();

	const iconMask = (paths: string[]): string =>
		`url("data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths
				.map((d) => `<path d="${d}"/>`)
				.join('')}</svg>`
		)}")`;

	// Lucide carrot and cooking pot, matching the toolbar's insert buttons.
	const ingredientMask = iconMask([
		'M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46',
		'M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z',
		'M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z'
	]);
	const cookwareMask = iconMask([
		'M2 12h20',
		'M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8',
		'm4 8 16-4',
		'm8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8'
	]);

	const theme = EditorView.theme({
		'&': {
			height: '100%',
			backgroundColor: 'transparent',
			color: 'var(--color-fg)'
		},
		'&.cm-focused': { outline: 'none' },
		'.cm-scroller': {
			fontFamily:
				'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
			fontSize: '14px',
			lineHeight: '1.5rem'
		},
		'.cm-content': {
			padding: '16px 16px',
			caretColor: 'var(--color-fg)'
		},
		'.cm-line': { padding: '0' },
		'.cm-gutters': {
			backgroundColor: 'var(--color-surface-muted)',
			color: 'var(--color-fg-subtle)',
			borderRight: '1px solid var(--color-border)'
		},
		'.cm-lineNumbers .cm-gutterElement': {
			padding: '0 8px 0 12px',
			minWidth: '24px'
		},
		'.cm-activeLineGutter': { backgroundColor: 'transparent' },
		'.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
			backgroundColor: 'var(--color-accent-soft)'
		},
		'.cm-cursor': { borderLeftColor: 'var(--color-fg)' },
		'.cm-placeholder': { color: 'var(--color-fg-subtle)' },
		'.cm-tooltip-autocomplete': {
			width: '18rem',
			backgroundColor: 'var(--color-surface)',
			border: '1px solid var(--color-border)',
			borderRadius: '0.5rem',
			boxShadow: '0 8px 24px oklch(0 0 0 / 0.14)',
			overflow: 'hidden',
			fontFamily: 'var(--font-sans)',
			color: 'var(--color-fg)'
		},
		'.cm-tooltip-autocomplete::before': {
			display: 'block',
			padding: '6px 10px',
			borderBottom: '1px solid var(--color-border)',
			color: 'var(--color-fg-subtle)',
			fontFamily: 'var(--font-sans)',
			fontSize: '11px',
			fontWeight: '600',
			letterSpacing: '0.05em',
			textTransform: 'uppercase'
		},
		'.cm-tooltip-autocomplete:has(.cm-completionIcon-ingredient)::before': {
			content: '"Ingredients"'
		},
		'.cm-tooltip-autocomplete:has(.cm-completionIcon-cookware)::before': {
			content: '"Cookware"'
		},
		'.cm-tooltip-autocomplete::after': {
			content: '"↑↓ · Enter"',
			position: 'absolute',
			top: '8px',
			right: '10px',
			color: 'var(--color-fg-subtle)',
			fontFamily: 'var(--font-sans)',
			fontSize: '11px'
		},
		'.cm-tooltip-autocomplete > ul': {
			maxHeight: '16rem',
			overflowY: 'auto',
			padding: '4px 0',
			margin: '0',
			fontFamily: 'inherit'
		},
		'.cm-tooltip-autocomplete > ul > li': {
			display: 'flex',
			alignItems: 'center',
			padding: '6px 10px',
			fontSize: '14px',
			lineHeight: '1.35rem',
			cursor: 'pointer'
		},
		'.cm-tooltip-autocomplete > ul > li:hover': {
			backgroundColor: 'var(--color-surface-muted)'
		},
		'.cm-tooltip-autocomplete > ul > li[aria-selected]': {
			backgroundColor: 'var(--color-accent-soft)',
			color: 'var(--color-accent-soft-fg)'
		},
		'.cm-completionIcon': {
			width: '14px',
			height: '14px',
			display: 'inline-block',
			flex: '0 0 auto',
			marginRight: '8px',
			paddingRight: '0',
			opacity: '1',
			backgroundColor: 'var(--color-accent)',
			WebkitMaskImage: ingredientMask,
			maskImage: ingredientMask,
			WebkitMaskSize: '14px 14px',
			maskSize: '14px 14px',
			WebkitMaskRepeat: 'no-repeat',
			maskRepeat: 'no-repeat',
			WebkitMaskPosition: 'center',
			maskPosition: 'center'
		},
		'.cm-completionIcon-cookware': {
			backgroundColor: 'var(--color-accent2)',
			WebkitMaskImage: cookwareMask,
			maskImage: cookwareMask
		},
		'.cm-completionLabel': {
			flex: '1 1 auto',
			minWidth: '0',
			overflow: 'hidden',
			textOverflow: 'ellipsis',
			whiteSpace: 'nowrap'
		},
		'.cm-completionDetail': {
			flex: '0 0 auto',
			marginLeft: '8px',
			color: 'var(--color-fg-subtle)',
			fontSize: '11px',
			fontStyle: 'normal',
			fontVariantNumeric: 'tabular-nums'
		},
		'.cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail': {
			color: 'inherit',
			opacity: '0.75'
		},
		'.cm-tooltip': {
			backgroundColor: 'var(--color-surface)',
			border: '1px solid var(--color-border)',
			borderRadius: '0.5rem',
			boxShadow: '0 8px 24px oklch(0 0 0 / 0.14)',
			color: 'var(--color-fg)',
			fontFamily: 'var(--font-sans)'
		},
		'.cm-lintRange-error': {
			backgroundImage: 'none',
			textDecorationLine: 'underline',
			textDecorationStyle: 'wavy',
			textDecorationColor: 'var(--color-danger)',
			textDecorationThickness: '1px',
			textUnderlineOffset: '2px'
		},
		'.cm-lintRange-warning': {
			backgroundImage: 'none',
			textDecorationLine: 'underline',
			textDecorationStyle: 'wavy',
			textDecorationColor: 'var(--color-warn-soft-fg)',
			textDecorationThickness: '1px',
			textUnderlineOffset: '2px'
		},
		'.cm-lintRange-info': {
			backgroundImage: 'none',
			textDecorationLine: 'underline',
			textDecorationStyle: 'wavy',
			textDecorationColor: 'var(--color-fg-subtle)',
			textDecorationThickness: '1px',
			textUnderlineOffset: '2px'
		},
		'.cm-lintRange-active': {
			backgroundColor: 'color-mix(in oklab, var(--color-accent-soft) 50%, transparent)'
		},
		'.cm-tooltip-lint': {
			maxWidth: '22rem',
			padding: '0',
			margin: '0',
			overflow: 'hidden',
			backgroundColor: 'transparent',
			border: 'none',
			borderRadius: 'inherit',
			boxShadow: 'none',
			fontFamily: 'var(--font-sans)'
		},
		'.cm-tooltip-lint .cm-diagnostic': {
			padding: '7px 10px',
			fontSize: '12px',
			lineHeight: '1.35rem'
		},
		'.cm-tooltip-lint .cm-diagnosticText': {
			whiteSpace: 'pre-wrap'
		},
		'.cm-tooltip-lint .cm-diagnostic-error': {
			borderLeft: '3px solid var(--color-danger)'
		},
		'.cm-tooltip-lint .cm-diagnostic-warning': {
			borderLeft: '3px solid var(--color-warn-soft-fg)'
		},
		'.cm-tooltip-lint .cm-diagnostic-info': {
			borderLeft: '3px solid var(--color-fg-subtle)'
		},
		'.cm-tooltip-lint .cm-diagnosticSource': {
			marginTop: '2px',
			color: 'var(--color-fg-subtle)',
			fontSize: '11px',
			letterSpacing: '0.05em',
			textTransform: 'uppercase'
		},
		'.cm-panels': {
			backgroundColor: 'var(--color-surface-muted)',
			color: 'var(--color-fg)'
		}
	});

	function insertTwoSpaces(target: EditorView): boolean {
		target.dispatch(target.state.replaceSelection('  '));
		return true;
	}

	function reportCaret(state: EditorState): void {
		const head = state.selection.main.head;
		const line = state.doc.lineAt(head);
		oncaret({ line: line.number, column: head - line.from + 1 });
	}

	function reportHistory(state: EditorState): void {
		onhistory({ undo: undoDepth(state), redo: redoDepth(state) });
	}

	const updateListener = EditorView.updateListener.of((update) => {
		if (update.docChanged) {
			const next = update.state.doc.toString();
			if (next !== value) onvalue(next);
		}

		if (update.docChanged || update.selectionSet) reportCaret(update.state);
		if (update.docChanged || update.transactions.length > 0) reportHistory(update.state);
	});

	const saveBinding = {
		key: 'Mod-s',
		preventDefault: true,
		run: () => {
			onsave();
			return true;
		}
	};

	const toolbarBindings = [
		{
			key: 'Mod-b',
			preventDefault: true,
			run: () => {
				onbold();
				return true;
			}
		},
		{
			key: 'Mod-/',
			preventDefault: true,
			run: () => {
				oncomment();
				return true;
			}
		},
		{
			key: 'Mod-Shift-m',
			preventDefault: true,
			run: () => {
				ontoggleconsole();
				return true;
			}
		}
	];

	const handle: SourceEditorHandle = {
		focus() {
			view?.focus();
		},
		getSelection() {
			if (!view) return { start: 0, end: 0 };
			const { from, to } = view.state.selection.main;
			return { start: from, end: to };
		},
		setValue(next, selectionStart = next.length, selectionEnd = selectionStart) {
			if (!view) return;

			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: next },
				selection: { anchor: selectionStart, head: selectionEnd },
				scrollIntoView: true
			});
			view.focus();
		},
		undo() {
			if (view) undo(view);
		},
		redo() {
			if (view) redo(view);
		}
	};

	/**
	 * Push the preview endpoint's line diagnostics into CodeMirror's lint
	 * decorations. The lint extension is enabled lazily by `setDiagnostics`,
	 * so there is no separate linter loop.
	 */
	function syncDiagnostics(editor: EditorView): void {
		const mapped = cooklangDiagnostics(editor.state, diagnostics);
		const key = mapped
			.map(
				(diagnostic) =>
					`${diagnostic.from}:${diagnostic.to}:${diagnostic.severity}:${diagnostic.message}`
			)
			.join('|');

		if (key === lastDiagnosticsKey) return;
		lastDiagnosticsKey = key;
		editor.dispatch(setDiagnostics(editor.state, mapped));
	}

	onMount(() => {
		if (!host) return;

		const state = EditorState.create({
			doc: value,
			extensions: [
				lineNumbers(),
				highlightSpecialChars(),
				history(),
				bracketMatching(),
				closeBrackets(),
				autocompletion({
					override: [cooklangCompletionSource(() => terms)],
					activateOnTyping: true
				}),
				cooklangLanguage,
				cooklangHighlighting,
				theme,
				wrapCompartment.of(wrap ? EditorView.lineWrapping : []),
				placeholder('Write a Cooklang recipe…'),
				scrollPastEnd(),
				EditorView.contentAttributes.of({
					'aria-label': 'Recipe source',
					autocapitalize: 'off',
					spellcheck: 'false'
				}),
				keymap.of([
					saveBinding,
					...toolbarBindings,
					...closeBracketsKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					...completionKeymap,
					{ key: 'Tab', run: insertTwoSpaces }
				]),
				updateListener
			]
		});

		const editor = new EditorView({ state, parent: host });
		view = editor;
		reportCaret(state);
		reportHistory(state);
		syncDiagnostics(editor);
		onready?.(handle);

		return () => {
			editor.destroy();
			view = null;
		};
	});

	// Push outside changes (a form action resetting the document, for example)
	// into the editor without echoing the editor's own updates back.
	$effect(() => {
		const next = value;
		const editor = view;
		if (!editor) return;
		if (next === editor.state.doc.toString()) return;

		editor.dispatch({
			changes: { from: 0, to: editor.state.doc.length, insert: next }
		});
	});

	$effect(() => {
		void diagnostics;
		if (view) syncDiagnostics(view);
	});

	$effect(() => {
		const wrapping = wrap;
		view?.dispatch({
			effects: wrapCompartment.reconfigure(wrapping ? EditorView.lineWrapping : [])
		});
	});
</script>

<div bind:this={host} class="h-full min-h-0 w-full overflow-hidden"></div>
