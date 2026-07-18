import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserStatus } from '../model/identity.enums';
import type { UserRow, UserWithCredentialRow } from '../model/identity.rows';
import { UserRepository } from './user.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

const USER_ROW: UserRow = {
  id: 'user-1',
  email: 'Coach@example.test',
  role: 'admin',
  status: 'active',
  display_name: 'Coach',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  deleted_at: null,
  version: 1,
};

describe('UserRepository', () => {
  let repository: UserRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new UserRepository();
    scope = createScope();
  });

  it('maps a found user by id into the domain aggregate', async () => {
    scope.run.mockResolvedValue([USER_ROW]);

    const user = await repository.findById(
      scope as unknown as TransactionScope,
      'user-1',
    );

    expect(user).toEqual({
      id: 'user-1',
      email: 'Coach@example.test',
      role: Role.Admin,
      status: UserStatus.Active,
      displayName: 'Coach',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      deletedAt: null,
      version: 1,
    });
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM "users"');
    expect(params).toEqual(['user-1']);
  });

  it('returns null when no user matches by id', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findById(scope as unknown as TransactionScope, 'missing'),
    ).resolves.toBeNull();
  });

  it('finds an active user by normalized email', async () => {
    scope.run.mockResolvedValue([USER_ROW]);

    const user = await repository.findActiveByEmail(
      scope as unknown as TransactionScope,
      'coach@example.test',
    );

    expect(user?.id).toBe('user-1');
    const [sql] = scope.run.mock.calls[0] as [string];
    expect(sql).toContain('lower("email")');
  });

  it('returns null when no active user matches by email', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findActiveByEmail(
        scope as unknown as TransactionScope,
        'nobody@example.test',
      ),
    ).resolves.toBeNull();
  });

  it('joins the credential when loading a user with credential', async () => {
    const row: UserWithCredentialRow = {
      ...USER_ROW,
      password_hash: '$2b$10$hash',
    };
    scope.run.mockResolvedValue([row]);

    const result = await repository.findWithCredentialByEmail(
      scope as unknown as TransactionScope,
      'coach@example.test',
    );

    expect(result?.passwordHash).toBe('$2b$10$hash');
    expect(result?.user.id).toBe('user-1');
  });

  it('returns null when no user with credential matches', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findWithCredentialByEmail(
        scope as unknown as TransactionScope,
        'nobody@example.test',
      ),
    ).resolves.toBeNull();
  });

  it('inserts a user and returns the persisted aggregate', async () => {
    scope.run.mockResolvedValue([USER_ROW]);
    const now = new Date('2026-01-01T00:00:00.000Z');

    const user = await repository.insert(scope as unknown as TransactionScope, {
      id: 'user-1',
      email: 'coach@example.test',
      role: Role.Admin,
      status: UserStatus.Active,
      displayName: 'Coach',
      now,
    });

    expect(user.id).toBe('user-1');
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "users"');
    expect(params).toEqual([
      'user-1',
      'coach@example.test',
      Role.Admin,
      UserStatus.Active,
      'Coach',
      now.toISOString(),
    ]);
  });
});
