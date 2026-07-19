import { describe, expect, it } from 'vitest';

import { ScoreCategory, SCORE_CATEGORY_VALUES } from '../model/scoring.enums';
import type { CategoryInput } from '../model/scoring.types';
import {
  buildSourceHash,
  parseEnumValue,
  resolveScoringPage,
  roundNullable,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './scoring.helpers';

function input(
  categoryKey: ScoreCategory,
  value: number | null,
): CategoryInput {
  return { categoryKey, value, assessedMetrics: 1, totalMetrics: 1 };
}

describe('resolveScoringPage', () => {
  it('applies defaults and clamps the limit', () => {
    expect(resolveScoringPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveScoringPage(500, 40)).toEqual({ limit: 100, offset: 40 });
    expect(resolveScoringPage(10, 5)).toEqual({ limit: 10, offset: 5 });
  });
});

describe('date and number coercion', () => {
  it('coerces dates and numbers, preserving null', () => {
    const date = new Date('2026-03-01T00:00:00.000Z');
    expect(toDate(date)).toBe(date);
    expect(toDate('2026-03-01T00:00:00.000Z').getTime()).toBe(date.getTime());
    expect(toNullableDate(null)).toBeNull();
    expect(toNullableDate('2026-03-01T00:00:00.000Z')?.getTime()).toBe(
      date.getTime(),
    );
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('3.5')).toBe(3.5);
    expect(toNumber(4)).toBe(4);
    expect(toNumber('4')).toBe(4);
  });
});

describe('parseEnumValue', () => {
  it('returns a known value and throws on an unknown one', () => {
    expect(
      parseEnumValue(SCORE_CATEGORY_VALUES, 'training', 'category'),
    ).toBe(ScoreCategory.Training);
    expect(() =>
      parseEnumValue(SCORE_CATEGORY_VALUES, 'nope', 'category'),
    ).toThrow('Unrecognized category: nope');
  });
});

describe('roundNullable', () => {
  it('rounds a value at the display boundary and keeps null null', () => {
    expect(roundNullable(null, 2)).toBeNull();
    expect(roundNullable(3.14159, 2)).toBe(3.14);
    expect(roundNullable(2.005, 2)).toBe(2.01);
    expect(roundNullable(4, 2)).toBe(4);
  });
});

describe('buildSourceHash', () => {
  it('is deterministic and order-independent', () => {
    const a = buildSourceHash('rule-1', 1, [
      input(ScoreCategory.Training, 4),
      input(ScoreCategory.Attendance, null),
    ]);
    const b = buildSourceHash('rule-1', 1, [
      input(ScoreCategory.Attendance, null),
      input(ScoreCategory.Training, 4),
    ]);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('changes when the rule version or a value changes', () => {
    const base = buildSourceHash('rule-1', 1, [input(ScoreCategory.Training, 4)]);
    expect(base).not.toBe(
      buildSourceHash('rule-1', 2, [input(ScoreCategory.Training, 4)]),
    );
    expect(base).not.toBe(
      buildSourceHash('rule-1', 1, [input(ScoreCategory.Training, 5)]),
    );
  });
});
