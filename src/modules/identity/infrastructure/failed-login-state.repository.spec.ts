import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FailedLoginStateRow } from '../model/identity.rows';
import { FailedLoginStateRepository } from './failed-login-state.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

const STATE_ROW: FailedLoginStateRow = {
  id: 'fls-1',
  email: 'user@example.test',
  attempt_count: 2,
  first_attempt_at: '2026-01-01T00:00:00.000Z',
  locked_until: null,
};

describe('FailedLoginStateRepository', () => {
  let repository: FailedLoginStateRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new FailedLoginStateRepository();
    scope = createScope();
  });

  it('locks the row and maps it when found by normalized email', async () => {
    scope.run.mockResolvedValue([STATE_ROW]);

    const state = await repository.findByEmailForUpdate(
      scope as unknown as TransactionScope,
      'user@example.test',
    );

    expect(state).toEqual({
      id: 'fls-1',
      email: 'user@example.test',
      attemptCount: 2,
      firstAttemptAt: new Date('2026-01-01T00:00:00.000Z'),
      lockedUntil: null,
    });
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('lower("email")');
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual(['user@example.test']);
  });

  it('maps a locked_until timestamp when present', async () => {
    const row: FailedLoginStateRow = {
      ...STATE_ROW,
      locked_until: '2026-01-01T01:00:00.000Z',
    };
    scope.run.mockResolvedValue([row]);

    const state = await repository.findByEmailForUpdate(
      scope as unknown as TransactionScope,
      'user@example.test',
    );

    expect(state?.lockedUntil).toEqual(new Date('2026-01-01T01:00:00.000Z'));
  });

  it('returns null when no state matches by email', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findByEmailForUpdate(
        scope as unknown as TransactionScope,
        'nobody@example.test',
      ),
    ).resolves.toBeNull();
  });

  it('inserts a new state with a null lockout window', async () => {
    scope.run.mockResolvedValue([]);
    const firstAttemptAt = new Date('2026-01-01T00:00:00.000Z');

    await repository.insert(scope as unknown as TransactionScope, {
      id: 'fls-1',
      email: 'user@example.test',
      attemptCount: 1,
      firstAttemptAt,
      lockedUntil: null,
    });

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "failed_login_state"');
    expect(params).toEqual([
      'fls-1',
      'user@example.test',
      1,
      firstAttemptAt.toISOString(),
      null,
    ]);
  });

  it('inserts a new state with a lockout window', async () => {
    scope.run.mockResolvedValue([]);
    const firstAttemptAt = new Date('2026-01-01T00:00:00.000Z');
    const lockedUntil = new Date('2026-01-01T01:00:00.000Z');

    await repository.insert(scope as unknown as TransactionScope, {
      id: 'fls-1',
      email: 'user@example.test',
      attemptCount: 5,
      firstAttemptAt,
      lockedUntil,
    });

    const [, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([
      'fls-1',
      'user@example.test',
      5,
      firstAttemptAt.toISOString(),
      lockedUntil.toISOString(),
    ]);
  });

  it('updates a state with a null lockout window', async () => {
    scope.run.mockResolvedValue([]);
    const firstAttemptAt = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-01T00:05:00.000Z');

    await repository.update(scope as unknown as TransactionScope, {
      id: 'fls-1',
      attemptCount: 3,
      firstAttemptAt,
      lockedUntil: null,
      now,
    });

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "failed_login_state"');
    expect(params).toEqual([
      'fls-1',
      3,
      firstAttemptAt.toISOString(),
      null,
      now.toISOString(),
    ]);
  });

  it('updates a state with a lockout window', async () => {
    scope.run.mockResolvedValue([]);
    const firstAttemptAt = new Date('2026-01-01T00:00:00.000Z');
    const lockedUntil = new Date('2026-01-01T01:00:00.000Z');
    const now = new Date('2026-01-01T00:05:00.000Z');

    await repository.update(scope as unknown as TransactionScope, {
      id: 'fls-1',
      attemptCount: 6,
      firstAttemptAt,
      lockedUntil,
      now,
    });

    const [, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([
      'fls-1',
      6,
      firstAttemptAt.toISOString(),
      lockedUntil.toISOString(),
      now.toISOString(),
    ]);
  });

  it('clears state by normalized email', async () => {
    scope.run.mockResolvedValue([]);

    await repository.clearByEmail(
      scope as unknown as TransactionScope,
      'user@example.test',
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM "failed_login_state"');
    expect(sql).toContain('lower("email")');
    expect(params).toEqual(['user@example.test']);
  });
});
