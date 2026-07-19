import { describe, expect, it } from 'vitest';

import { computeSeedChecksum } from './seed-checksum';

describe('computeSeedChecksum', () => {
  it('is deterministic for identical content', () => {
    expect(computeSeedChecksum('admin-seeder:v1')).toBe(
      computeSeedChecksum('admin-seeder:v1'),
    );
  });

  it('changes when the content changes', () => {
    expect(computeSeedChecksum('admin-seeder:v1')).not.toBe(
      computeSeedChecksum('admin-seeder:v2'),
    );
  });

  it('returns a 64-character hex sha-256 digest', () => {
    const checksum = computeSeedChecksum('content');

    expect(checksum).toMatch(/^[0-9a-f]{64}$/u);
  });
});
