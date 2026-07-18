import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import { InvitationNotFoundError } from '../errors/invitation-not-found.error';
import { InvitationStatus, SecurityEventType } from '../model/identity.enums';
import type { Invitation } from '../model/identity.types';
import { ResendInvitationUseCase } from './resend-invitation.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const IDENTITY_CONFIG = {
  refreshTokenTtlSeconds: 1000,
  invitationTtlSeconds: 1000,
  passwordResetTtlSeconds: 1000,
  maxFailedLoginAttempts: 3,
  failedLoginWindowSeconds: 900,
  accountLockoutSeconds: 900,
};

const PENDING_INVITATION: Invitation = {
  id: 'inv-1',
  email: 'coach@example.test',
  invitedBy: 'admin-1',
  role: 'admin' as Invitation['role'],
  status: InvitationStatus.Pending,
  expiresAt: new Date(NOW.getTime() + 60_000),
  acceptedAt: null,
  revokedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function build() {
  const scope = { run: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn(async (op: (s: typeof scope) => Promise<unknown>) =>
      op(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const secureRandom = { generateToken: vi.fn().mockReturnValue('rawtoken') };
  const config = { identity: IDENTITY_CONFIG };
  const invitations = {
    findById: vi.fn(),
    rotateToken: vi.fn(),
  };
  const audit = { record: vi.fn() };

  const useCase = new ResendInvitationUseCase(
    unitOfWork as never,
    clock,
    secureRandom,
    config as never,
    invitations as never,
    audit as never,
  );

  return { useCase, invitations, audit };
}

describe('ResendInvitationUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('rotates the token, audits, and returns a fresh summary', async () => {
    harness.invitations.findById.mockResolvedValue(PENDING_INVITATION);

    const result = await harness.useCase.execute('inv-1', 'admin-1');

    expect(harness.invitations.rotateToken).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.InvitationResent,
      'admin-1',
      { invitationId: PENDING_INVITATION.id },
    );
    expect(result.id).toBe(PENDING_INVITATION.id);
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + 1000 * 1000));
    expect(result.status).toBe(InvitationStatus.Pending);
  });

  it('throws not-found when the invitation is missing', async () => {
    harness.invitations.findById.mockResolvedValue(null);

    await expect(
      harness.useCase.execute('inv-1', 'admin-1'),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    expect(harness.invitations.rotateToken).not.toHaveBeenCalled();
  });

  it('throws invalid when the invitation is not pending', async () => {
    harness.invitations.findById.mockResolvedValue({
      ...PENDING_INVITATION,
      status: InvitationStatus.Accepted,
    });

    await expect(
      harness.useCase.execute('inv-1', 'admin-1'),
    ).rejects.toBeInstanceOf(InvitationInvalidError);
    expect(harness.invitations.rotateToken).not.toHaveBeenCalled();
  });
});
