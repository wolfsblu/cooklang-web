import { describe, expect, it } from 'vitest';
import {
	addDays,
	dayInfo,
	formatWeekRange,
	isInWeek,
	parseISODate,
	startOfWeek,
	toISODate,
	weekDates
} from './week';

describe('toISODate and parseISODate', () => {
	it('formats a Date in UTC', () => {
		// 23:30 UTC is already the next day in much of Europe; UTC is the
		// contract the planner stores and renders in.
		expect(toISODate(new Date('2026-11-16T23:30:00Z'))).toBe('2026-11-16');
	});

	it('accepts real dates and normalizes nothing', () => {
		expect(parseISODate('2026-11-16')).toBe('2026-11-16');
		expect(parseISODate('2028-02-29')).toBe('2028-02-29');
	});

	it('rejects impossible and malformed dates', () => {
		expect(parseISODate('2026-02-30')).toBeNull();
		expect(parseISODate('2026-13-01')).toBeNull();
		expect(parseISODate('16-11-2026')).toBeNull();
		expect(parseISODate('')).toBeNull();
		expect(parseISODate(null)).toBeNull();
	});
});

describe('startOfWeek', () => {
	it('keeps a Monday and folds the rest of the week back to it', () => {
		expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
		expect(startOfWeek('2026-11-18')).toBe('2026-11-16');
		expect(startOfWeek('2026-11-22')).toBe('2026-11-16'); // Sunday
	});

	it('crosses a month boundary', () => {
		// 1 March 2026 is a Sunday.
		expect(startOfWeek('2026-03-01')).toBe('2026-02-23');
	});

	it('crosses a year boundary', () => {
		// 1 January 2026 is a Thursday.
		expect(startOfWeek('2026-01-01')).toBe('2025-12-29');
	});

	it('handles a leap day', () => {
		// 29 February 2028 is a Tuesday.
		expect(startOfWeek('2028-02-29')).toBe('2028-02-28');
	});
});

describe('addDays and weekDates', () => {
	it('produces seven consecutive dates from Monday to Sunday', () => {
		expect(weekDates('2026-11-16')).toEqual([
			'2026-11-16',
			'2026-11-17',
			'2026-11-18',
			'2026-11-19',
			'2026-11-20',
			'2026-11-21',
			'2026-11-22'
		]);
	});

	it('crosses a year boundary without losing a day', () => {
		expect(weekDates('2025-12-29')).toEqual([
			'2025-12-29',
			'2025-12-30',
			'2025-12-31',
			'2026-01-01',
			'2026-01-02',
			'2026-01-03',
			'2026-01-04'
		]);
	});

	it('steps through a European DST week in UTC', () => {
		// Clocks go forward on Sunday 29 March 2026 in Europe. UTC arithmetic
		// must not lose or repeat an hour, and the last day must stay Sunday.
		expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
		expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
		expect(weekDates('2026-03-23').at(-1)).toBe('2026-03-29');
	});

	it('steps through a US DST week in UTC', () => {
		// Clocks go forward on Sunday 8 March 2026 in the United States.
		expect(weekDates('2026-03-02').at(-1)).toBe('2026-03-08');
		expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
	});

	it('steps through an autumn DST week in UTC', () => {
		// Clocks go back on Sunday 25 October 2026 in Europe.
		expect(weekDates('2026-10-19').at(-1)).toBe('2026-10-25');
		expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
	});
});

describe('isInWeek', () => {
	it('includes both ends and excludes the neighbouring weeks', () => {
		expect(isInWeek('2026-11-16', '2026-11-16')).toBe(true);
		expect(isInWeek('2026-11-22', '2026-11-16')).toBe(true);
		expect(isInWeek('2026-11-23', '2026-11-16')).toBe(false);
		expect(isInWeek('2026-11-15', '2026-11-16')).toBe(false);
	});
});

describe('dayInfo', () => {
	it('formats labels with UTC and the explicit en-GB locale', () => {
		expect(dayInfo('2026-11-16')).toEqual({
			weekday: 'Monday',
			weekdayShort: 'Mon',
			dayNumber: '16',
			month: 'Nov',
			label: 'Monday 16 November 2026'
		});
	});
});

describe('formatWeekRange', () => {
	it('collapses a range inside one month', () => {
		expect(formatWeekRange('2026-11-16')).toBe('16–22 Nov 2026');
	});

	it('names both months when the week spans a boundary', () => {
		expect(formatWeekRange('2026-11-30')).toBe('30 Nov – 6 Dec 2026');
	});

	it('names both years when the week spans New Year', () => {
		expect(formatWeekRange('2025-12-29')).toBe('29 Dec 2025 – 4 Jan 2026');
	});
});
