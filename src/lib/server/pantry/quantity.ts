/**
 * Cooklang pantry quantities.
 *
 * The format is `amount%unit` ("500%g", "1%L") or a bare count ("6").
 */

export interface ParsedQuantity {
	amount: number;
	unit: string | null;
}

/** Parse a raw quantity string. Returns null for text amounts like "a jar". */
export function parseQuantity(raw: string | null): ParsedQuantity | null {
	if (!raw) return null;

	const [amountPart, ...unitParts] = raw.split('%');
	const unit = unitParts.join('%').trim() || null;

	const trimmed = amountPart.trim();

	// Fractions appear in recipes ("1/2%cup"); accept them here too.
	const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (fraction) {
		const denominator = Number(fraction[2]);
		if (denominator === 0) return null;
		return { amount: Number(fraction[1]) / denominator, unit };
	}

	const amount = Number(trimmed);
	if (!Number.isFinite(amount)) return null;

	return { amount, unit };
}

/** Format for display, e.g. "500 g" or "6". */
export function formatQuantity(raw: string | null): string | null {
	const parsed = parseQuantity(raw);
	if (!parsed) return raw;

	const amount =
		parsed.amount % 1 === 0
			? String(parsed.amount)
			: parsed.amount.toFixed(2).replace(/\.?0+$/, '');

	return parsed.unit ? `${amount} ${parsed.unit}` : amount;
}

/** Units that mean the same thing, so a comparison between them is meaningful. */
const UNIT_ALIASES: Record<string, string> = {
	g: 'g',
	gram: 'g',
	grams: 'g',
	kg: 'kg',
	kilogram: 'kg',
	kilograms: 'kg',
	ml: 'ml',
	milliliter: 'ml',
	milliliters: 'ml',
	l: 'l',
	liter: 'l',
	liters: 'l',
	litre: 'l',
	litres: 'l'
};

/** Conversions to a common base, per dimension. */
const TO_BASE: Record<string, { dimension: string; factor: number }> = {
	g: { dimension: 'mass', factor: 1 },
	kg: { dimension: 'mass', factor: 1000 },
	ml: { dimension: 'volume', factor: 1 },
	l: { dimension: 'volume', factor: 1000 }
};

function normalize(unit: string | null): { dimension: string; factor: number } | null {
	if (!unit) return { dimension: 'count', factor: 1 };
	const canonical = UNIT_ALIASES[unit.trim().toLowerCase()];
	return canonical ? TO_BASE[canonical] : null;
}

/**
 * Compare two quantities, or null when they are not comparable.
 *
 * Unknown or mismatched units return null rather than guessing. The Cook CLI
 * takes the same line -- it warns "Unit mismatch for 'salt': recipe needs '',
 * pantry has 'g'" and declines to subtract -- and claiming an item is low on
 * the strength of a bad comparison is worse than saying nothing.
 */
export function compareQuantities(a: string | null, b: string | null): number | null {
	const left = parseQuantity(a);
	const right = parseQuantity(b);
	if (!left || !right) return null;

	const leftUnit = normalize(left.unit);
	const rightUnit = normalize(right.unit);
	if (!leftUnit || !rightUnit) return null;
	if (leftUnit.dimension !== rightUnit.dimension) return null;

	return left.amount * leftUnit.factor - right.amount * rightUnit.factor;
}

/** True when stock has fallen to or below the item's declared threshold. */
export function isLow(item: { quantity: string | null; low: string | null }): boolean {
	if (!item.low) return false;
	const comparison = compareQuantities(item.quantity, item.low);
	return comparison !== null && comparison <= 0;
}

/** Whole days until the expiry date; negative once past. Null when undated. */
export function daysUntilExpiry(
	item: { expire: string | null },
	now: Date = new Date()
): number | null {
	if (!item.expire) return null;

	const expiry = new Date(item.expire);
	if (Number.isNaN(expiry.getTime())) return null;

	const DAY_MS = 86_400_000;
	const dayNumber = (year: number, month: number, date: number) =>
		Math.floor(Date.UTC(year, month, date) / DAY_MS);

	// A date-only value ("2026-08-10") is a calendar date, not an instant.
	// Reading its Y/M/D back with local getters shifts it a day earlier for
	// anyone west of UTC, because the Date is midnight UTC. Take the written
	// date parts directly when they are there.
	const written = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.expire);
	const expiryDay = written
		? dayNumber(Number(written[1]), Number(written[2]) - 1, Number(written[3]))
		: dayNumber(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());

	// "Today" is the server's own calendar day, matching how the badge reads.
	const today = dayNumber(now.getFullYear(), now.getMonth(), now.getDate());

	return expiryDay - today;
}

/** Expiring within a week, or already past. */
export function isExpiringSoon(item: { expire: string | null }, now: Date = new Date()): boolean {
	const days = daysUntilExpiry(item, now);
	return days !== null && days <= 7;
}
