<script lang="ts">
	import { Portal } from 'bits-ui';
	/**
	 * A transient status message, styled like the existing New Recipe toast:
	 * fixed above the page, above dialogs, and announced politely.
	 *
	 * The parent owns the message. Clearing it calls `onclose`, which lets the
	 * next distinct message start a fresh timer even when the text is identical.
	 */
	interface Props {
		message: string | null;
		onclose?: () => void;
		/** How long the toast stays up. */
		duration?: number;
		tone?: 'default' | 'danger';
	}

	const { message, onclose, duration = 4000, tone = 'default' }: Props = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (!message) return;

		if (timer) clearTimeout(timer);
		timer = setTimeout(() => onclose?.(), duration);

		return () => {
			if (timer) clearTimeout(timer);
		};
	});
</script>

<Portal>
	{#if message}
		<div
			class="pointer-events-none fixed inset-x-0 top-16 z-[80] flex justify-center px-4"
			role="status"
			aria-live="polite"
		>
			<div
				class="notice-toast shadow-pop max-w-[min(100%,28rem)] rounded-full px-4 py-2 text-sm font-medium {tone ===
				'danger'
					? 'bg-danger-soft text-danger-soft-fg'
					: 'bg-fg text-canvas'}"
			>
				{message}
			</div>
		</div>
	{/if}
</Portal>

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
