import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationInvalidError } from '../errors/invitation-invalid.error';
import { InvitationStatus } from '../model/identity.enums';
import type { PublicInvitationRecord } from '../model/identity.types';
import { GetInvitationDetailsUseCase } from './get-invitation-details.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const INVITATION: PublicInvitationRecord = {
  id: 'invitation-1',
  email: 'invitee@example.test',
  invitedBy: 'user-1',
  inviterName: 'Coach One',
  role: Role.User,
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
    runInTransaction: vi.fn(
      async (operation: (value: typeof scope) => Promise<unknown>) =>
        operation(scope),
    ),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW), uptime: vi.fn() };
  const invitations = {
    findPublicByTokenHash: vi.fn().mockResolvedValue(INVITATION),
  };
  const useCase = new GetInvitationDetailsUseCase(
    unitOfWork as never,
    clock,
    invitations as never,
  );
  return { useCase, invitations };
}

describe('GetInvitationDetailsUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a minimal truthful projection for a valid pending token', async () => {
    await expect(
      harness.useCase.execute('opaque-invitation-token'),
    ).resolves.toEqual({
      email: INVITATION.email,
      role: Role.User,
      inviterName: 'Coach One',
      expiresAt: INVITATION.expiresAt,
    });
    expect(harness.invitations.findPublicByTokenHash).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.stringContaining('opaque-invitation-token'),
    );
  });

  it.each([
    null,
    { ...INVITATION, status: InvitationStatus.Accepted },
    { ...INVITATION, expiresAt: NOW },
    { ...INVITATION, revokedAt: NOW },
  ])(
    'rejects unknown or unusable invitation state %# generically',
    async value => {
      harness.invitations.findPublicByTokenHash.mockResolvedValue(value);

      await expect(
        harness.useCase.execute('opaque-invitation-token'),
      ).rejects.toBeInstanceOf(InvitationInvalidError);
    },
  );
});
