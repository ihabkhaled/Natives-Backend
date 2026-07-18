import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { UserStatus } from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { GetCurrentPrincipalUseCase } from './get-current-principal.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const ACTIVE_USER: User = {
  id: 'user-1',
  email: 'coach@example.test',
  role: 'admin' as User['role'],
  status: UserStatus.Active,
  displayName: 'Coach',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const users = { findById: vi.fn() };
  const permissionResolver = {
    resolve: vi.fn().mockResolvedValue(new Set(['team.read', 'practice.read'])),
  };

  const useCase = new GetCurrentPrincipalUseCase(
    unitOfWork as never,
    permissionResolver,
    users as never,
  );

  return { permissionResolver, useCase, users };
}

describe('GetCurrentPrincipalUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns the frontend auth-user contract for an active user', async () => {
    harness.users.findById.mockResolvedValue(ACTIVE_USER);

    const result = await harness.useCase.execute('user-1');

    expect(result).toEqual({
      id: ACTIVE_USER.id,
      email: ACTIVE_USER.email,
      displayName: 'Coach',
      permissions: ['practice.read', 'team.read'],
      accountState: 'active',
      onboardingComplete: true,
      memberships: [],
    });
    expect(harness.permissionResolver.resolve).toHaveBeenCalledWith(
      {
        userId: ACTIVE_USER.id,
        email: ACTIVE_USER.email,
        roles: [ACTIVE_USER.role],
      },
      {},
    );
  });

  it('throws when the user is missing', async () => {
    harness.users.findById.mockResolvedValue(null);

    await expect(harness.useCase.execute('user-1')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('throws when the user is no longer active', async () => {
    harness.users.findById.mockResolvedValue({
      ...ACTIVE_USER,
      status: UserStatus.Suspended,
    });

    await expect(harness.useCase.execute('user-1')).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});
