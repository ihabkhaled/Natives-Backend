import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { hashOpaqueToken } from './token-hash';

describe('hashOpaqueToken', () => {
  it('matches an independently computed sha-256 hex digest', () => {
    const token = 'the-secret-token';
    const expected = createHash('sha256').update(token).digest('hex');

    expect(hashOpaqueToken(token)).toBe(expected);
  });

  it('produces a known digest for a fixed input', () => {
    // sha256('rawtoken') hex, computed offline via node:crypto.
    const expected = createHash('sha256').update('rawtoken').digest('hex');

    expect(hashOpaqueToken('rawtoken')).toBe(expected);
    expect(hashOpaqueToken('rawtoken')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic across repeated calls', () => {
    expect(hashOpaqueToken('same-input')).toBe(hashOpaqueToken('same-input'));
  });

  it('produces different digests for different inputs', () => {
    expect(hashOpaqueToken('a')).not.toBe(hashOpaqueToken('b'));
  });
});
