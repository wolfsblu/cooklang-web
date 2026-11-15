<script lang="ts">
	import {
		BoldIcon,
		BookOpenIcon,
		CarrotIcon,
		Columns2Icon,
		CookingPotIcon,
		EyeIcon,
		Heading2Icon,
		MessageSquareIcon,
		Redo2Icon,
		SquarePenIcon,
		TextWrapIcon,
		TimerIcon,
		Undo2Icon
	} from '@lucide/svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';

	export type EditorViewMode = 'write' | 'split' | 'preview';

	interface Props {
		canUndo: boolean;
		canRedo: boolean;
		wrap: boolean;
		viewMode: EditorViewMode;
		onundo: () => void;
		onredo: () => void;
		oninsertingredient: () => void;
		oninsertcookware: () => void;
		oninserttimer: () => void;
		oninsertsection: () => void;
		ontogglecomment: () => void;
		onbold: () => void;
		onopencheatsheet: () => void;
		ontogglewrap: () => void;
		onviewmode: (mode: EditorViewMode) => void;
	}

	const {
		canUndo,
		canRedo,
		wrap,
		viewMode,
		onundo,
		onredo,
		oninsertingredient,
		oninsertcookware,
		oninserttimer,
		oninsertsection,
		ontogglecomment,
		onbold,
		onopencheatsheet,
		ontogglewrap,
		onviewmode
	}: Props = $props();

	/**
	 * Ignore the second click of a double click. Without this, each click runs
	 * its own edit and the second one wraps the placeholder selected by the
	 * first, producing nonsense such as `@@ingredient{}{}`.
	 */
	let lastActionAt = 0;

	function run(action: () => void | Promise<void>): void {
		const now = performance.now();
		if (now - lastActionAt < 300) return;
		lastActionAt = now;
		void action();
	}
</script>

<div
	class="border-border bg-surface no-scrollbar flex shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto border-b px-3 py-1.5 md:px-4 [&_button]:shrink-0"
>
	<div class="flex items-center gap-0.5" role="group" aria-label="History">
		<IconButton
			label="Undo"
			title="Undo (Ctrl+Z)"
			size="sm"
			variant="toolbar"
			disabled={!canUndo}
			onclick={onundo}
		>
			<Undo2Icon class="size-4" />
		</IconButton>
		<IconButton
			label="Redo"
			title="Redo (Ctrl+Shift+Z)"
			size="sm"
			variant="toolbar"
			disabled={!canRedo}
			onclick={onredo}
		>
			<Redo2Icon class="size-4" />
		</IconButton>
	</div>

	<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>

	<div class="flex items-center gap-0.5" role="group" aria-label="Insert">
		<IconButton
			label="Insert ingredient"
			title="Insert ingredient"
			size="sm"
			variant="toolbar"
			onclick={() => run(oninsertingredient)}
		>
			<CarrotIcon class="text-accent size-4" />
		</IconButton>
		<IconButton
			label="Insert cookware"
			title="Insert cookware"
			size="sm"
			variant="toolbar"
			onclick={() => run(oninsertcookware)}
		>
			<CookingPotIcon class="text-accent2 size-4" />
		</IconButton>
		<IconButton
			label="Insert timer"
			title="Insert timer"
			size="sm"
			variant="toolbar"
			onclick={() => run(oninserttimer)}
		>
			<TimerIcon class="text-warn-soft-fg size-4" />
		</IconButton>
	</div>

	<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>

	<div class="flex items-center gap-0.5" role="group" aria-label="Formatting">
		<IconButton
			label="Insert section"
			title="Insert section"
			size="sm"
			variant="toolbar"
			onclick={() => run(oninsertsection)}
		>
			<Heading2Icon class="size-4" />
		</IconButton>
		<IconButton
			label="Toggle comment"
			title="Toggle comment (Ctrl+/)"
			size="sm"
			variant="toolbar"
			onclick={() => run(ontogglecomment)}
		>
			<MessageSquareIcon class="size-4" />
		</IconButton>
		<IconButton
			label="Bold"
			title="Bold (Ctrl+B)"
			size="sm"
			variant="toolbar"
			onclick={() => run(onbold)}
		>
			<BoldIcon class="size-4" />
		</IconButton>
	</div>

	<div class="ml-auto flex items-center gap-0.5">
		<IconButton
			label="Cooklang syntax reference"
			title="Cooklang syntax reference"
			size="sm"
			variant="toolbar"
			onclick={onopencheatsheet}
		>
			<BookOpenIcon class="size-4" />
		</IconButton>

		<span class="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true"></span>

		<IconButton
			label="Line wrapping"
			title="Line wrapping"
			size="sm"
			variant={wrap ? 'soft' : 'toolbar'}
			aria-pressed={wrap}
			onclick={ontogglewrap}
		>
			<TextWrapIcon class="size-4" />
		</IconButton>

		<div
			class="bg-surface-muted ml-1 flex items-center gap-0.5 rounded-md"
			role="group"
			aria-label="Editor view"
		>
			<IconButton
				label="Write only"
				title="Write only"
				size="sm"
				variant={viewMode === 'write' ? 'outline' : 'toolbar'}
				aria-pressed={viewMode === 'write'}
				onclick={() => onviewmode('write')}
			>
				<SquarePenIcon class="size-4" />
			</IconButton>
			<IconButton
				label="Split editor and preview"
				title="Split editor and preview"
				size="sm"
				variant={viewMode === 'split' ? 'outline' : 'toolbar'}
				aria-pressed={viewMode === 'split'}
				onclick={() => onviewmode('split')}
			>
				<Columns2Icon class="size-4" />
			</IconButton>
			<IconButton
				label="Preview only"
				title="Preview only"
				size="sm"
				variant={viewMode === 'preview' ? 'outline' : 'toolbar'}
				aria-pressed={viewMode === 'preview'}
				onclick={() => onviewmode('preview')}
			>
				<EyeIcon class="size-4" />
			</IconButton>
		</div>
	</div>
</div>
