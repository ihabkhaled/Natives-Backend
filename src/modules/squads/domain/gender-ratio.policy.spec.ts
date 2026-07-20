import { describe, expect, it } from 'vitest';

import { GenderBucket } from '../model/squads.enums';
import type { GenderCount } from '../model/squads.types';
import { bucketGender, summarizeGenderRatio } from './gender-ratio.policy';

describe('gender-ratio.policy', () => {
  it('buckets recognized gender tokens', () => {
    expect(bucketGender('man')).toBe(GenderBucket.Men);
    expect(bucketGender('woman')).toBe(GenderBucket.Women);
    expect(bucketGender('nonbinary')).toBe(GenderBucket.Mixed);
  });

  it('buckets undisclosed, null, and unknown tokens as unknown', () => {
    expect(bucketGender('undisclosed')).toBe(GenderBucket.Unknown);
    expect(bucketGender(null)).toBe(GenderBucket.Unknown);
    expect(bucketGender('other')).toBe(GenderBucket.Unknown);
  });

  it('summarizes a balanced ratio when both men and women are present', () => {
    const counts: GenderCount[] = [
      { gender: 'man', count: 5 },
      { gender: 'woman', count: 4 },
      { gender: 'nonbinary', count: 1 },
      { gender: 'undisclosed', count: 2 },
    ];
    const ratio = summarizeGenderRatio(counts);
    expect(ratio).toEqual({
      men: 5,
      women: 4,
      mixed: 1,
      unknown: 2,
      total: 12,
      balanced: true,
    });
  });

  it('folds null genders into unknown and is unbalanced when a gender is missing', () => {
    const ratio = summarizeGenderRatio([
      { gender: 'man', count: 3 },
      { gender: null, count: 2 },
    ]);
    expect(ratio.men).toBe(3);
    expect(ratio.women).toBe(0);
    expect(ratio.unknown).toBe(2);
    expect(ratio.total).toBe(5);
    expect(ratio.balanced).toBe(false);
  });

  it('is unbalanced with only women present and empty input yields zeroes', () => {
    expect(summarizeGenderRatio([{ gender: 'woman', count: 2 }]).balanced).toBe(
      false,
    );
    const empty = summarizeGenderRatio([]);
    expect(empty.total).toBe(0);
    expect(empty.balanced).toBe(false);
  });
});
