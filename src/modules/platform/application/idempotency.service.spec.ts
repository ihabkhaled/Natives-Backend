import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdempotencyConflictError } from '../errors/idempotency-conflict.error';
import { IdempotencyOutcome, IdempotencyStatus } from '../model/platform.enums';
import type {
  IdempotencyLookup,
  IdempotencyRecord,
} from '../model/platform.types';
import { IdempotencyService } from './idempotency.service';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const EXPIRES = new Date('2026-06-02T12:00:00.000Z');

function build() {
  const idGenerator = { generate: vi.fn().mockReturnValue('rec-gen') };
  const repository = {
    findByKey: vi.fn(),
    insertInProgress: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
  };
  const service = new IdempotencyService(idGenerator, repository);
  return { service, repository };
}

const LOOKUP: IdempotencyLookup = {
  key: 'k-1',
  requestHash: 'h-1',
  principalUserId: 'user-1',
  scopeKey: 'team-1',
  expiresAt: EXPIRES,
  now: NOW,
};

function completed(
  overrides: Partial<IdempotencyRecord> = {},
): IdempotencyRecord {
  return {
    id: 'rec-1',
    key: 'k-1',
    requestHash: 'h-1',
    principalUserId: 'user-1',
    scopeKey: 'team-1',
    status: IdempotencyStatus.Completed,
    statusCode: 200,
    result: { id: 'x' },
    expiresAt: EXPIRES,
    createdAt: NOW,
    ...overrides,
  };
}

describe('IdempotencyService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('reserves a new in-progress record for a first request', async () => {
    harness.repository.findByKey.mockResolvedValue(null);
    const decision = await harness.service.begin(SCOPE, LOOKUP);
    expect(decision.outcome).toBe(IdempotencyOutcome.New);
    expect(decision.recordId).toBe('rec-gen');
    expect(
      harness.repository.insertInProgress.mock.calls[0]?.[1],
    ).toMatchObject({ id: 'rec-gen', key: 'k-1' });
  });

  it('replays the stored result for a completed same-hash request', async () => {
    harness.repository.findByKey.mockResolvedValue(completed());
    const decision = await harness.service.begin(SCOPE, LOOKUP);
    expect(decision.outcome).toBe(IdempotencyOutcome.Replay);
    expect(decision.statusCode).toBe(200);
    expect(decision.result).toEqual({ id: 'x' });
    expect(harness.repository.insertInProgress).not.toHaveBeenCalled();
  });

  it('rejects a mismatched request hash with a conflict', async () => {
    harness.repository.findByKey.mockResolvedValue(
      completed({ requestHash: 'other' }),
    );
    await expect(harness.service.begin(SCOPE, LOOKUP)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it('rejects an in-flight duplicate with a conflict', async () => {
    harness.repository.findByKey.mockResolvedValue(
      completed({ status: IdempotencyStatus.InProgress }),
    );
    await expect(harness.service.begin(SCOPE, LOOKUP)).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it('completes a record with the final status and result', async () => {
    await harness.service.complete(SCOPE, 'rec-1', 201, { id: 'x' }, NOW);
    expect(harness.repository.complete).toHaveBeenCalledWith(
      SCOPE,
      'rec-1',
      201,
      { id: 'x' },
      NOW,
    );
  });
});
