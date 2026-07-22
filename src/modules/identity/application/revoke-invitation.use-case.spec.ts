import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import { InvitationNotFoundError } from '../errors/invitation-not-found.error';
import { InvitationStatus, SecurityEventType } from '../model/identity.enums';
import type { Invitation } from '../model/identity.types';
import { RevokeInvitationUseCase } from './revoke-invitation.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const PENDING_INVITATION: Invitation = {
  id: 'inv-1',
  email: 'coach@example.test',
  invitedBy: 'admin-1',
  role: 'admin' as Invitation['role'],
  teamId: null,
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
  const invitations = {
    findById: vi.fn(),
    markRevoked: vi.fn(),
  };
  const audit = { record: vi.fn() };

  const useCase = new RevokeInvitationUseCase(
    unitOfWork as never,
    clock,
    invitations as never,
    audit as never,
  );

  return { useCase, invitations, audit };
}

describe('RevokeInvitationUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('marks revoked, audits, and returns a revoked summary', async () => {
    harness.invitations.findById.mockResolvedValue(PENDING_INVITATION);

    const result = await harness.useCase.execute('inv-1', 'admin-1');

    expect(harness.invitations.markRevoked).toHaveBeenCalledWith(
      expect.anything(),
      PENDING_INVITATION.id,
      NOW,
    );
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.InvitationRevoked,
      'admin-1',
      { invitationId: PENDING_INVITATION.id },
    );
    expect(result.status).toBe(InvitationStatus.Revoked);
  });

  it('throws not-found when the invitation is missing', async () => {
    harness.invitations.findById.mockResolvedValue(null);

    await expect(
      harness.useCase.execute('inv-1', 'admin-1'),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    expect(harness.invitations.markRevoked).not.toHaveBeenCalled();
  });

  it('throws invalid when the invitation is not pending', async () => {
    harness.invitations.findById.mockResolvedValue({
      ...PENDING_INVITATION,
      status: InvitationStatus.Expired,
    });

    await expect(
      harness.useCase.execute('inv-1', 'admin-1'),
    ).rejects.toBeInstanceOf(InvitationInvalidError);
    expect(harness.invitations.markRevoked).not.toHaveBeenCalled();
  });
});
