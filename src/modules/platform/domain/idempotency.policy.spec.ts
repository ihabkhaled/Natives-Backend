import { describe, expect, it } from 'vitest';

import { IdempotencyOutcome, IdempotencyStatus } from '../model/platform.enums';
import type { IdempotencyRecord } from '../model/platform.types';
import { classifyIdempotency } from './idempotency.policy';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function record(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    id: 'rec-1',
    key: 'key-1',
    requestHash: 'hash-1',
    principalUserId: 'user-1',
    scopeKey: null,
    status: IdempotencyStatus.Completed,
    statusCode: 200,
    result: { ok: true },
    expiresAt: NOW,
    createdAt: NOW,
    ...overrides,
  };
}

describe('classifyIdempotency', () => {
  it('is New when there is no stored record', () => {
    expect(classifyIdempotency(null, 'hash-1')).toBe(IdempotencyOutcome.New);
  });

  it('is Conflict when the request hash differs', () => {
    expect(classifyIdempotency(record(), 'other-hash')).toBe(
      IdempotencyOutcome.Conflict,
    );
  });

  it('is Replay when the same key completed with the same hash', () => {
    expect(classifyIdempotency(record(), 'hash-1')).toBe(
      IdempotencyOutcome.Replay,
    );
  });

  it('is Conflict when a same-hash attempt is still in progress', () => {
    expect(
      classifyIdempotency(
        record({ status: IdempotencyStatus.InProgress }),
        'hash-1',
      ),
    ).toBe(IdempotencyOutcome.Conflict);
  });
});
