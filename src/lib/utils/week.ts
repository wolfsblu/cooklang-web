/**
 * Week maths for the meal planner.
 *
 * Everything happens on ISO date strings at UTC midnight. Doing the arithmetic
 * in local time would make month, year and daylight-saving boundaries depend on
 * the server's and the browser's time zones; in UTC a week is always seven
 * 86_400_000 ms steps and a Thursday is always a Thursday.
 *
 * Display labels use an explicit locale and `timeZone: 'UTC'` for the same
 * reason: a label formatted with the ambient locale can differ between SSR and
 * hydration. The page load formats labels and sends them to the client, rather
 * than formatting during render.
 */

export const DAY_MS = 86_400_000;

/** The locale the whole app is written in. Explicit so SSR and the browser agree. */
const LOCALE = 'en-GB';

const WEEKDAY_LONG = new Intl.DateTimeFormat(LOCALE, {
	weekday: 'long',
	timeZone: 'UTC'
});
const WEEKDAY_SHORT = new Intl.DateTimeFormat(LOCALE, {
	weekday: 'short',
	timeZone: 'UTC'
});
const DAY_NUMBER = new Intl.DateTimeFormat(LOCALE, {
	day: 'numeric',
	timeZone: 'UTC'
});
const MONTH_SHORT = new Intl.DateTimeFormat(LOCALE, {
	month: 'short',
	timeZone: 'UTC'
});
const MONTH_LONG = new Intl.DateTimeFormat(LOCALE, {
	month: 'long',
	timeZone: 'UTC'
});
const YEAR = new Intl.DateTimeFormat(LOCALE, {
	year: 'numeric',
	timeZone: 'UTC'
});

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

function atMidnight(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

/** A Date as `YYYY-MM-DD` in UTC. */
export function toISODate(date: Date): string {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Validate a date string and return it normalized, or null.
 *
 * Date.parse happily turns "2026-02-30" into March, so the round-trip check is
 * what rejects impossible calendar dates.
 */
export function parseISODate(value: string | null | undefined): string | null {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

	const parsed = Date.parse(`${value}T00:00:00Z`);
	if (!Number.isFinite(parsed)) return null;
	if (toISODate(new Date(parsed)) !== value) return null;

	return value;
}

/** Add (or subtract) whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
	return toISODate(new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS));
}

/**
 * The Monday of the week containing `iso`.
 *
 * `getUTCDay()` is 0 for Sunday, so Sunday belongs to the week that started six
 * days earlier; Monday stays where it is.
 */
export function startOfWeek(iso: string): string {
	const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
	const offset = (weekday + 6) % 7;
	return addDays(iso, -offset);
}

/** The seven ISO dates of the week beginning on `mondayISO`. */
export function weekDates(mondayISO: string): string[] {
	return Array.from({ length: 7 }, (_, index) => addDays(mondayISO, index));
}

/** Whether an ISO date falls inside the Monday-to-Sunday week. */
export function isInWeek(iso: string, mondayISO: string): boolean {
	const offset = (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${mondayISO}T00:00:00Z`)) / DAY_MS;
	return Number.isInteger(offset) && offset >= 0 && offset < 7;
}

export interface DayInfo {
	weekday: string;
	weekdayShort: string;
	dayNumber: string;
	month: string;
	label: string;
}

/** The display pieces for one day, computed in UTC. */
export function dayInfo(iso: string): DayInfo {
	const date = atMidnight(iso);
	const weekday = WEEKDAY_LONG.format(date);
	const dayNumber = DAY_NUMBER.format(date);
	const month = MONTH_SHORT.format(date);

	return {
		weekday,
		weekdayShort: WEEKDAY_SHORT.format(date),
		dayNumber,
		month,
		label: `${weekday} ${dayNumber} ${MONTH_LONG.format(date)} ${YEAR.format(date)}`
	};
}

/**
 * A compact label for a Monday-to-Sunday range.
 *
 *   same month:   "16–22 Nov 2026"
 *   same year:    "30 Nov – 6 Dec 2026"
 *   other year:   "29 Dec 2025 – 4 Jan 2026"
 */
export function formatWeekRange(mondayISO: string): string {
	const start = atMidnight(mondayISO);
	const end = atMidnight(addDays(mondayISO, 6));

	const startDay = DAY_NUMBER.format(start);
	const endDay = DAY_NUMBER.format(end);
	const startMonth = MONTH_SHORT.format(start);
	const endMonth = MONTH_SHORT.format(end);
	const startYear = YEAR.format(start);
	const endYear = YEAR.format(end);

	if (startYear !== endYear) {
		return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
	}

	if (startMonth !== endMonth) {
		return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
	}

	return `${startDay}–${endDay} ${endMonth} ${endYear}`;
}
