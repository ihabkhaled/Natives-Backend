import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RefreshSessionRow } from '../model/identity.rows';
import { RefreshSessionRepository } from './refresh-session.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

const SESSION_ROW: RefreshSessionRow = {
  id: 'sess-1',
  user_id: 'user-1',
  family_id: 'fam-1',
  device_label: 'iPhone',
  issued_at: '2026-01-01T00:00:00.000Z',
  expires_at: '2026-01-08T00:00:00.000Z',
  rotated_at: null,
  revoked_at: null,
  reuse_detected_at: null,
};

describe('RefreshSessionRepository', () => {
  let repository: RefreshSessionRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new RefreshSessionRepository();
    scope = createScope();
  });

  it('inserts a refresh session and returns the persisted aggregate', async () => {
    scope.run.mockResolvedValue([SESSION_ROW]);
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const expiresAt = new Date('2026-01-08T00:00:00.000Z');

    const session = await repository.insert(
      scope as unknown as TransactionScope,
      {
        id: 'sess-1',
        userId: 'user-1',
        tokenHash: 'hash-1',
        familyId: 'fam-1',
        deviceLabel: 'iPhone',
        issuedAt,
        expiresAt,
      },
    );

    expect(session).toEqual({
      id: 'sess-1',
      userId: 'user-1',
      familyId: 'fam-1',
      deviceLabel: 'iPhone',
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2026-01-08T00:00:00.000Z'),
      rotatedAt: null,
      revokedAt: null,
      reuseDetectedAt: null,
    });
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "refresh_sessions"');
    expect(params).toEqual([
      'sess-1',
      'user-1',
      'hash-1',
      'fam-1',
      'iPhone',
      issuedAt.toISOString(),
      expiresAt.toISOString(),
    ]);
  });

  it('locks the session row when looking up by token hash', async () => {
    scope.run.mockResolvedValue([SESSION_ROW]);

    const session = await repository.findByTokenHashForUpdate(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(session?.id).toBe('sess-1');
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual(['hash-1']);
  });

  it('returns null when no session matches by token hash', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findByTokenHashForUpdate(
        scope as unknown as TransactionScope,
        'missing',
      ),
    ).resolves.toBeNull();
  });

  it('maps rotation, revocation and reuse timestamps when present', async () => {
    const row: RefreshSessionRow = {
      ...SESSION_ROW,
      device_label: null,
      rotated_at: '2026-01-02T00:00:00.000Z',
      revoked_at: '2026-01-03T00:00:00.000Z',
      reuse_detected_at: '2026-01-04T00:00:00.000Z',
    };
    scope.run.mockResolvedValue([row]);

    const session = await repository.findByTokenHashForUpdate(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(session?.deviceLabel).toBeNull();
    expect(session?.rotatedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(session?.revokedAt).toEqual(new Date('2026-01-03T00:00:00.000Z'));
    expect(session?.reuseDetectedAt).toEqual(
      new Date('2026-01-04T00:00:00.000Z'),
    );
  });

  it('marks a session rotated', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-05T00:00:00.000Z');

    await repository.markRotated(
      scope as unknown as TransactionScope,
      'sess-1',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "refresh_sessions"');
    expect(params).toEqual(['sess-1', now.toISOString()]);
  });

  it('revokes a session by id', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-05T00:00:00.000Z');

    await repository.revokeById(
      scope as unknown as TransactionScope,
      'sess-1',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "refresh_sessions"');
    expect(sql).toContain('"revoked_at" IS NULL');
    expect(params).toEqual(['sess-1', now.toISOString()]);
  });

  it('revokes an entire family for reuse', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-05T00:00:00.000Z');

    await repository.revokeFamilyForReuse(
      scope as unknown as TransactionScope,
      'fam-1',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "refresh_sessions"');
    expect(sql).toContain('"reuse_detected_at" = $2');
    expect(params).toEqual(['fam-1', now.toISOString()]);
  });

  it('revokes all sessions for a user and returns the affected count', async () => {
    scope.run.mockResolvedValue([SESSION_ROW, SESSION_ROW, SESSION_ROW]);
    const now = new Date('2026-01-05T00:00:00.000Z');

    const count = await repository.revokeAllForUser(
      scope as unknown as TransactionScope,
      'user-1',
      now,
    );

    expect(count).toBe(3);
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "refresh_sessions"');
    expect(params).toEqual(['user-1', now.toISOString()]);
  });

  it('returns zero when a user has no sessions to revoke', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.revokeAllForUser(
        scope as unknown as TransactionScope,
        'user-1',
        new Date('2026-01-05T00:00:00.000Z'),
      ),
    ).resolves.toBe(0);
  });
});
