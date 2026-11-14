import type { SectionDisplay, StepDisplay } from '$lib/types/recipe';

/** One step, flattened out of its section for cook mode navigation. */
export interface CookStep {
	step: StepDisplay;
	/** 1-based position across the whole recipe, not the section-local number. */
	ordinal: number;
	sectionIndex: number;
	/** The heading shown above the step in the outline, when one is useful. */
	sectionName: string | null;
}

/**
 * Flatten a recipe into cooking order.
 *
 * Cooklang restarts `number` at 1 inside every section, so the ordinal is the
 * only number that can drive a global step counter, arrow-key navigation or
 * the `Recipe.N.jpg` image convention.
 */
export function flattenCookSteps(sections: SectionDisplay[]): CookStep[] {
	const steps: CookStep[] = [];

	sections.forEach((section, sectionIndex) => {
		for (const content of section.content) {
			if (content.type !== 'step') continue;

			steps.push({
				step: content,
				ordinal: steps.length + 1,
				sectionIndex,
				// A single unnamed section needs no heading; several unnamed ones do.
				sectionName: section.name || (sections.length > 1 ? `Section ${sectionIndex + 1}` : null)
			});
		}
	});

	return steps;
}

/**
 * A short plain-text label for a step, used by the outline and editor tab.
 *
 * Steps carry no title of their own, so this summarizes what the step actually
 * does from its text and inline entities. It is clipped at a word boundary to
 * stay on one line in the sidebar, and falls back to an empty string so the
 * caller can decide what to show for an empty step.
 */
export function cookStepSummary(step: StepDisplay, maxLength = 72): string {
	let text = '';

	for (const item of step.items) {
		const piece =
			item.type === 'text'
				? item.value
				: item.type === 'ingredient' || item.type === 'cookware'
					? item.name
					: item.type === 'timer'
						? (item.name ?? item.quantity ?? '')
						: item.quantity;

		if (!piece) continue;

		// Text items usually carry their own spaces around inline entities.
		// Add one only when the prose does not already separate them, and never
		// before closing punctuation.
		const needsSpace = text.length > 0 && !/\s$/.test(text) && !/^[.,;:!?)\]]/.test(piece);
		text += `${needsSpace ? ' ' : ''}${piece}`;
	}

	text = text.replace(/\s+/g, ' ').trim();

	if (text.length <= maxLength) return text;

	const clipped = text.slice(0, maxLength);
	const lastSpace = clipped.lastIndexOf(' ');
	const cut = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
	return `${cut.trimEnd()}…`;
}
