import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignupNotFoundError } from '../errors/signup-not-found.error';
import {
  AccountState,
  SecurityEventType,
  UserStatus,
} from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { RejectSignupUseCase } from './reject-signup.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const PENDING_USER: User = {
  id: 'user-1',
  email: 'applicant@example.test',
  role: 'user' as User['role'],
  status: UserStatus.Pending,
  displayName: 'Sam',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

const COMMAND = { signupId: 'user-1', reviewerId: 'admin-1' };

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const users = {
    findByIdForUpdate: vi.fn().mockResolvedValue(PENDING_USER),
    markReviewed: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn() };
  const signupEmail = { sendRejected: vi.fn().mockResolvedValue(undefined) };

  const useCase = new RejectSignupUseCase(
    unitOfWork as never,
    clock,
    users as never,
    audit as never,
    signupEmail as never,
  );
  return { useCase, users, audit, signupEmail };
}

describe('RejectSignupUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('moves the account to the terminal rejected state, audits, and emails', async () => {
    const result = await harness.useCase.execute(COMMAND);

    expect(harness.users.markReviewed).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      UserStatus.Rejected,
      'admin-1',
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.SignupRejected,
      'admin-1',
      { signupId: 'user-1' },
    );
    expect(result.state).toBe(AccountState.Suspended);
    expect(harness.signupEmail.sendRejected).toHaveBeenCalled();
  });

  it('reports not-found (no state leak) when the signup is not pending', async () => {
    harness.users.findByIdForUpdate.mockResolvedValue({
      ...PENDING_USER,
      status: UserStatus.Rejected,
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      SignupNotFoundError,
    );
    expect(harness.users.markReviewed).not.toHaveBeenCalled();
  });
});
