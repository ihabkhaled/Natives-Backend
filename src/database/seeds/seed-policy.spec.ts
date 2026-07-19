import { describe, expect, it } from 'vitest';

import { SEED_APPLIED, SEED_CHANGED, SEED_SKIPPED } from './seed.constants';
import type { Seeder } from './seed.types';
import { decideSeedApplication } from './seed-policy';

const SEEDER: Seeder = {
  key: 'admin',
  checksum: 'checksum-a',
  run: () => Promise.resolve(),
};

describe('decideSeedApplication', () => {
  it('applies a seeder with no history row', () => {
    expect(decideSeedApplication(null, SEEDER)).toBe(SEED_APPLIED);
  });

  it('skips a seeder whose recorded checksum matches', () => {
    expect(decideSeedApplication({ checksum: 'checksum-a' }, SEEDER)).toBe(
      SEED_SKIPPED,
    );
  });

  it('reports a changed definition when the checksum drifted', () => {
    expect(decideSeedApplication({ checksum: 'checksum-old' }, SEEDER)).toBe(
      SEED_CHANGED,
    );
  });
});
