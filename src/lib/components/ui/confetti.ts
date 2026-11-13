/**
 * Confetti presets shared by the shopping list and the unassigned-ingredients
 * page.
 *
 * The pieces are fixed rather than generated with `Math.random()`: the burst
 * is rendered during SSR, so a random layout would differ on hydration. A
 * library such as svelte-confetti does exactly that, and its falling-gravity
 * animation is a different shape from the small radial bursts used here, so
 * these stay hand-authored.
 */

export interface ConfettiPiece {
	/** Horizontal travel from the burst origin, in pixels. */
	dx: number;
	/** Vertical travel from the burst origin, in pixels. */
	dy: number;
	/** Final rotation, in degrees. */
	rot: number;
	/** Animation delay, in milliseconds. */
	delay: number;
	/** Any CSS colour, usually a theme custom property. */
	color: string;
}

/** A full celebration: used for the whole list and the finished empty state. */
export const CELEBRATION_CONFETTI: readonly ConfettiPiece[] = [
	{ dx: -52, dy: -34, rot: -170, delay: 0, color: 'var(--color-brand-500)' },
	{ dx: 44, dy: -40, rot: 150, delay: 20, color: 'var(--color-herb-500)' },
	{ dx: -28, dy: -54, rot: -110, delay: 10, color: 'var(--color-warn-500)' },
	{ dx: 30, dy: -56, rot: 200, delay: 60, color: 'var(--color-brand-400)' },
	{ dx: -64, dy: 2, rot: -90, delay: 40, color: 'var(--color-herb-500)' },
	{ dx: 62, dy: 6, rot: 120, delay: 10, color: 'var(--color-warn-500)' },
	{ dx: -44, dy: 34, rot: 170, delay: 70, color: 'var(--color-brand-500)' },
	{ dx: 42, dy: 32, rot: -150, delay: 30, color: 'var(--color-herb-500)' },
	{ dx: 2, dy: -64, rot: 40, delay: 50, color: 'var(--color-brand-400)' },
	{ dx: 18, dy: -48, rot: 230, delay: 80, color: 'var(--color-warn-500)' },
	{ dx: -14, dy: -46, rot: -210, delay: 20, color: 'var(--color-herb-500)' },
	{ dx: 56, dy: -18, rot: 100, delay: 90, color: 'var(--color-brand-500)' },
	{ dx: -56, dy: -16, rot: -140, delay: 60, color: 'var(--color-warn-500)' },
	{ dx: 8, dy: 44, rot: 190, delay: 40, color: 'var(--color-brand-400)' }
];

/**
 * A short burst for an individual aisle header or a toast, so those moments do
 * not compete with the full celebration.
 */
export const COMPACT_CONFETTI: readonly ConfettiPiece[] = [
	{ dx: -18, dy: -16, rot: -120, delay: 0, color: 'var(--color-brand-500)' },
	{ dx: 16, dy: -20, rot: 100, delay: 20, color: 'var(--color-herb-500)' },
	{ dx: -22, dy: 2, rot: -80, delay: 10, color: 'var(--color-warn-500)' },
	{ dx: 22, dy: 4, rot: 90, delay: 30, color: 'var(--color-brand-400)' },
	{ dx: -12, dy: 18, rot: 120, delay: 40, color: 'var(--color-herb-500)' },
	{ dx: 12, dy: 16, rot: -140, delay: 10, color: 'var(--color-warn-500)' },
	{ dx: 0, dy: -24, rot: 30, delay: 50, color: 'var(--color-brand-500)' },
	{ dx: 4, dy: 22, rot: 160, delay: 20, color: 'var(--color-herb-500)' }
];
