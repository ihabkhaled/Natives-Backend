import { describe, expect, it } from 'vitest';

import { MAX_GENERATED_OCCURRENCES } from '../model/practices.constants';
import { RecurrenceFrequency } from '../model/practices.enums';
import type { RecurrenceRule } from '../model/practices.types';
import {
  addDays,
  daysBetween,
  generateOccurrenceDates,
  localWeekday,
} from './recurrence.policy';

function weekly(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    frequency: RecurrenceFrequency.Weekly,
    intervalWeeks: 1,
    weekdays: [1],
    generationStart: '2026-01-05',
    generationUntil: '2026-02-28',
    exceptions: [],
    ...overrides,
  };
}

describe('recurrence policy calendar helpers', () => {
  it('reads the weekday of a calendar date (0=Sunday)', () => {
    expect(localWeekday('2026-01-04')).toBe(0);
    expect(localWeekday('2026-01-05')).toBe(1);
    expect(localWeekday('2026-01-15')).toBe(4);
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-01-30', 2)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days between calendar dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-08')).toBe(7);
    expect(daysBetween('2026-01-08', '2026-01-01')).toBe(-7);
  });
});

describe('generateOccurrenceDates', () => {
  it('expands a weekly rule onto its weekday across the horizon', () => {
    expect(generateOccurrenceDates(weekly({}))).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
      '2026-01-26',
      '2026-02-02',
      '2026-02-09',
      '2026-02-16',
      '2026-02-23',
    ]);
  });

  it('honours a week interval greater than one, anchored to the start', () => {
    expect(generateOccurrenceDates(weekly({ intervalWeeks: 2 }))).toEqual([
      '2026-01-05',
      '2026-01-19',
      '2026-02-02',
      '2026-02-16',
    ]);
  });

  it('expands multiple weekdays in ascending date order', () => {
    const result = generateOccurrenceDates(
      weekly({ weekdays: [1, 3], generationUntil: '2026-01-18' }),
    );
    expect(result).toEqual([
      '2026-01-05',
      '2026-01-07',
      '2026-01-12',
      '2026-01-14',
    ]);
  });

  it('omits excepted dates', () => {
    const result = generateOccurrenceDates(
      weekly({ exceptions: ['2026-01-12', '2026-02-09'] }),
    );
    expect(result).not.toContain('2026-01-12');
    expect(result).not.toContain('2026-02-09');
    expect(result).toContain('2026-01-05');
  });

  it('yields a single date for a one-off schedule', () => {
    const result = generateOccurrenceDates(
      weekly({ frequency: RecurrenceFrequency.OneOff, weekdays: [] }),
    );
    expect(result).toEqual(['2026-01-05']);
  });

  it('yields nothing for a one-off whose only date is excepted', () => {
    const result = generateOccurrenceDates(
      weekly({
        frequency: RecurrenceFrequency.OneOff,
        weekdays: [],
        exceptions: ['2026-01-05'],
      }),
    );
    expect(result).toEqual([]);
  });

  it('caps a dense long-horizon expansion at the occurrence limit', () => {
    const result = generateOccurrenceDates(
      weekly({
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        generationStart: '2026-01-01',
        generationUntil: '2027-06-30',
      }),
    );
    expect(result).toHaveLength(MAX_GENERATED_OCCURRENCES);
  });
});
