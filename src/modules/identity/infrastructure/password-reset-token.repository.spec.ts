import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PasswordResetTokenRow } from '../model/identity.rows';
import { PasswordResetTokenRepository } from './password-reset-token.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

const TOKEN_ROW: PasswordResetTokenRow = {
  id: 'prt-1',
  user_id: 'user-1',
  expires_at: '2026-01-02T00:00:00.000Z',
  consumed_at: null,
};

describe('PasswordResetTokenRepository', () => {
  let repository: PasswordResetTokenRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new PasswordResetTokenRepository();
    scope = createScope();
  });

  it('inserts a password-reset token row', async () => {
    scope.run.mockResolvedValue([]);
    const expiresAt = new Date('2026-01-02T00:00:00.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');

    await repository.insert(scope as unknown as TransactionScope, {
      id: 'prt-1',
      userId: 'user-1',
      tokenHash: 'hash-1',
      expiresAt,
      now,
    });

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "password_reset_tokens"');
    expect(params).toEqual([
      'prt-1',
      'user-1',
      'hash-1',
      expiresAt.toISOString(),
      now.toISOString(),
    ]);
  });

  it('locks the token row and maps it when found by token hash', async () => {
    scope.run.mockResolvedValue([TOKEN_ROW]);

    const token = await repository.findByTokenHashForUpdate(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(token).toEqual({
      id: 'prt-1',
      userId: 'user-1',
      expiresAt: new Date('2026-01-02T00:00:00.000Z'),
      consumedAt: null,
    });
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual(['hash-1']);
  });

  it('maps a consumed timestamp when present', async () => {
    const row: PasswordResetTokenRow = {
      ...TOKEN_ROW,
      consumed_at: '2026-01-03T00:00:00.000Z',
    };
    scope.run.mockResolvedValue([row]);

    const token = await repository.findByTokenHashForUpdate(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(token?.consumedAt).toEqual(new Date('2026-01-03T00:00:00.000Z'));
  });

  it('returns null when no token matches by token hash', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findByTokenHashForUpdate(
        scope as unknown as TransactionScope,
        'missing',
      ),
    ).resolves.toBeNull();
  });

  it('marks a token consumed', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-03T00:00:00.000Z');

    await repository.markConsumed(
      scope as unknown as TransactionScope,
      'prt-1',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "password_reset_tokens"');
    expect(sql).toContain('"consumed_at" IS NULL');
    expect(params).toEqual(['prt-1', now.toISOString()]);
  });
});
