import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignupConflictError } from '../errors/signup-conflict.error';
import {
  AccountState,
  SecurityEventType,
  UserStatus,
} from '../model/identity.enums';
import type { User } from '../model/identity.types';
import { RequestSignupUseCase } from './request-signup.use-case';

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

const COMMAND = {
  email: 'Applicant@example.test',
  displayName: 'Sam',
  password: 'correct-horse-battery-staple',
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated-id') };
  const passwordHash = { hash: vi.fn().mockResolvedValue('hashed') };
  const users = {
    findActiveByEmail: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(PENDING_USER),
  };
  const credentials = { insert: vi.fn().mockResolvedValue(undefined) };
  const invitations = {
    findActivePendingByEmail: vi.fn().mockResolvedValue(null),
  };
  const audit = { record: vi.fn() };
  const signupEmail = {
    sendPendingNotifications: vi.fn().mockResolvedValue(undefined),
  };

  const useCase = new RequestSignupUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    passwordHash as never,
    users as never,
    credentials as never,
    invitations as never,
    audit as never,
    signupEmail as never,
  );
  return { useCase, users, credentials, invitations, audit, signupEmail };
}

describe('RequestSignupUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('creates a pending, inert account with a stored credential and audits it', async () => {
    const result = await harness.useCase.execute(COMMAND);

    expect(harness.users.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'applicant@example.test',
        status: UserStatus.Pending,
        displayName: 'Sam',
      }),
    );
    expect(harness.credentials.insert).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.SignupRequested,
      'user-1',
      { state: UserStatus.Pending },
    );
    expect(result.state).toBe(AccountState.Pending);
  });

  it('emails the applicant and admin after the signup commits', async () => {
    await harness.useCase.execute(COMMAND);

    expect(harness.signupEmail.sendPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'applicant@example.test' }),
    );
  });

  it('rejects a duplicate email (existing account) without writing', async () => {
    harness.users.findActiveByEmail.mockResolvedValue(PENDING_USER);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      SignupConflictError,
    );
    expect(harness.users.insert).not.toHaveBeenCalled();
    expect(harness.signupEmail.sendPendingNotifications).not.toHaveBeenCalled();
  });

  it('rejects when an active invitation already exists for the email', async () => {
    harness.invitations.findActivePendingByEmail.mockResolvedValue({
      id: 'inv-1',
    });

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      SignupConflictError,
    );
    expect(harness.users.insert).not.toHaveBeenCalled();
  });
});
