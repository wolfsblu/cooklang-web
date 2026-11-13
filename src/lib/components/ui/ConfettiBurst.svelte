<script lang="ts">
	import type { ConfettiPiece } from './confetti';

	/**
	 * A deterministic radial confetti burst.
	 *
	 * Pieces are passed in rather than generated so the server HTML and the
	 * hydrated client render match, and so the visual identity of each burst
	 * (a finished shopping trip, a sorted aisle) stays under our control.
	 */
	interface Props {
		pieces: readonly ConfettiPiece[];
		/** Extra positioning utilities, e.g. a z-index. */
		class?: string;
	}

	const { pieces, class: className = '' }: Props = $props();
</script>

<span class="pointer-events-none absolute inset-0 {className}" aria-hidden="true">
	{#each pieces as piece, index (index)}
		<span
			class="confetti-piece"
			style="--dx: {piece.dx}px; --dy: {piece.dy}px; --rot: {piece.rot}deg; --delay: {piece.delay}ms; background-color: {piece.color}"
		></span>
	{/each}
</span>

<style>
	.confetti-piece {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 6px;
		height: 10px;
		border-radius: 2px;
		animation: confetti-burst 900ms cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
		animation-delay: var(--delay);
	}

	@keyframes confetti-burst {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) rotate(0deg) scale(0.6);
		}
		15% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot))
				scale(1);
		}
	}
</style>
