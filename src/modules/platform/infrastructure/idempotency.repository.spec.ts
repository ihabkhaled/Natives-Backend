import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdempotencyStatus } from '../model/platform.enums';
import type { IdempotencyRow } from '../model/platform.rows';
import type { NewIdempotencyRecord } from '../model/platform.types';
import { IdempotencyRepository } from './idempotency.repository';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const EXPIRES = new Date('2026-06-02T12:00:00.000Z');

function buildScope() {
  return { run: vi.fn() };
}

const ROW: IdempotencyRow = {
  id: 'rec-1',
  idempotency_key: 'k-1',
  request_hash: 'h-1',
  principal_user_id: 'user-1',
  scope_key: null,
  status: 'in_progress',
  status_code: null,
  result: null,
  expires_at: NOW,
  created_at: NOW,
};

describe('IdempotencyRepository', () => {
  let repo: IdempotencyRepository;
  let scope: ReturnType<typeof buildScope>;

  beforeEach(() => {
    repo = new IdempotencyRepository();
    scope = buildScope();
  });

  it('finds a record by key + principal or returns null', async () => {
    scope.run.mockResolvedValueOnce([ROW]);
    const found = await repo.findByKey(scope as never, 'k-1', 'user-1');
    expect(found?.status).toBe(IdempotencyStatus.InProgress);
    expect(scope.run.mock.calls[0]?.[1]).toEqual(['k-1', 'user-1']);

    scope.run.mockResolvedValueOnce([]);
    expect(await repo.findByKey(scope as never, 'k-2', 'user-1')).toBeNull();
  });

  it('inserts an in-progress record', async () => {
    scope.run.mockResolvedValueOnce([]);
    const record: NewIdempotencyRecord = {
      id: 'rec-1',
      key: 'k-1',
      requestHash: 'h-1',
      principalUserId: 'user-1',
      scopeKey: 'team-1',
      expiresAt: EXPIRES,
      now: NOW,
    };
    await repo.insertInProgress(scope as never, record);
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params).toEqual([
      'rec-1',
      'k-1',
      'h-1',
      'user-1',
      'team-1',
      EXPIRES.toISOString(),
      NOW.toISOString(),
    ]);
    expect(scope.run.mock.calls[0]?.[0]).toContain("'in_progress'");
  });

  it('completes a record with a serialized result', async () => {
    scope.run.mockResolvedValueOnce([]);
    await repo.complete(scope as never, 'rec-1', 201, { id: 'x' }, NOW);
    const params = scope.run.mock.calls[0]?.[1] ?? [];
    expect(params[1]).toBe(201);
    expect(params[2]).toBe(JSON.stringify({ id: 'x' }));
  });
});
