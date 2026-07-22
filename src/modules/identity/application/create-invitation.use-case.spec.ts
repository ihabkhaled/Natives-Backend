import {
  EscalationDeniedError,
  ProtectedRoleError,
  RoleNotFoundError,
} from '@modules/rbac';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationConflictError } from '../errors/invitation-conflict.error';
import {
  InvitationStatus,
  SecurityEventType,
  UserStatus,
} from '../model/identity.enums';
import type { Invitation, User } from '../model/identity.types';
import { CreateInvitationUseCase } from './create-invitation.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');

const IDENTITY_CONFIG = {
  refreshTokenTtlSeconds: 1000,
  invitationTtlSeconds: 1000,
  passwordResetTtlSeconds: 1000,
  maxFailedLoginAttempts: 3,
  failedLoginWindowSeconds: 900,
  accountLockoutSeconds: 900,
};

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

const INSERTED_INVITATION: Invitation = {
  id: 'inv-1',
  email: 'coach@example.test',
  invitedBy: 'admin-1',
  role: 'admin' as Invitation['role'],
  teamId: null,
  teamRoleKey: 'MEMBER',
  status: InvitationStatus.Pending,
  expiresAt: new Date(NOW.getTime() + 1000 * 1000),
  acceptedAt: null,
  revokedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const MEMBER_ROLE = {
  id: 'role-member',
  key: 'MEMBER',
  scope: 'team',
  isAssignable: true,
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
  const secureRandom = { generateToken: vi.fn().mockReturnValue('rawtoken') };
  const config = { identity: IDENTITY_CONFIG };
  const users = { findActiveByEmail: vi.fn().mockResolvedValue(null) };
  const invitations = {
    findActivePendingByEmail: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(INSERTED_INVITATION),
  };
  const roleAssignments = {
    assertGrantable: vi.fn().mockResolvedValue(MEMBER_ROLE),
  };
  const audit = { record: vi.fn() };
  const invitationEmail = { send: vi.fn().mockResolvedValue(undefined) };

  const useCase = new CreateInvitationUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    secureRandom,
    config as never,
    users as never,
    invitations as never,
    roleAssignments as never,
    audit as never,
    invitationEmail as never,
  );

  return {
    useCase,
    users,
    invitations,
    roleAssignments,
    audit,
    invitationEmail,
  };
}

const ACTOR = {
  userId: 'admin-1',
  email: 'admin@example.test',
  roles: ['admin'],
} as never;

const COMMAND = {
  email: 'Coach@example.test',
  role: 'admin' as User['role'],
  actor: ACTOR,
  teamId: null,
  teamRoleSlug: null,
};

describe('CreateInvitationUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts an invitation, audits, and returns a delivery with its one-time token', async () => {
    const result = await harness.useCase.execute(COMMAND);

    expect(result).toEqual({
      id: INSERTED_INVITATION.id,
      email: INSERTED_INVITATION.email,
      role: INSERTED_INVITATION.role,
      teamId: null,
      teamRole: 'member',
      status: INSERTED_INVITATION.status,
      expiresAt: INSERTED_INVITATION.expiresAt,
      createdAt: INSERTED_INVITATION.createdAt,
      token: 'rawtoken',
    });
    expect(harness.invitations.insert).toHaveBeenCalled();
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.InvitationCreated,
      'admin-1',
      { invitationId: INSERTED_INVITATION.id, teamRoleKey: 'MEMBER' },
    );
  });

  it('defaults the team role to member when the command carries none', async () => {
    await harness.useCase.execute(COMMAND);

    expect(harness.roleAssignments.assertGrantable).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR,
      'member',
      null,
    );
    expect(harness.invitations.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamRoleKey: 'MEMBER' }),
    );
  });

  it('validates the requested slug in-transaction and persists the resolved key', async () => {
    harness.roleAssignments.assertGrantable.mockResolvedValue({
      id: 'role-coach',
      key: 'COACH',
      scope: 'team',
      isAssignable: true,
    });
    harness.invitations.insert.mockResolvedValue({
      ...INSERTED_INVITATION,
      teamId: 'team-1',
      teamRoleKey: 'COACH',
    });

    const result = await harness.useCase.execute({
      ...COMMAND,
      teamId: 'team-1',
      teamRoleSlug: 'coach',
    });

    expect(harness.roleAssignments.assertGrantable).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR,
      'coach',
      'team-1',
    );
    expect(harness.invitations.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamId: 'team-1', teamRoleKey: 'COACH' }),
    );
    expect(result.teamRole).toBe('coach');
    expect(harness.audit.record).toHaveBeenCalledWith(
      expect.anything(),
      SecurityEventType.InvitationCreated,
      'admin-1',
      {
        invitationId: INSERTED_INVITATION.id,
        teamRoleKey: 'COACH',
        teamId: 'team-1',
      },
    );
  });

  it('propagates an unknown-role rejection and writes nothing', async () => {
    harness.roleAssignments.assertGrantable.mockRejectedValue(
      new RoleNotFoundError(),
    );

    await expect(
      harness.useCase.execute({ ...COMMAND, teamRoleSlug: 'physio' }),
    ).rejects.toBeInstanceOf(RoleNotFoundError);
    expect(harness.invitations.insert).not.toHaveBeenCalled();
    expect(harness.invitationEmail.send).not.toHaveBeenCalled();
  });

  it('propagates a protected-role rejection and writes nothing', async () => {
    harness.roleAssignments.assertGrantable.mockRejectedValue(
      new ProtectedRoleError(),
    );

    await expect(
      harness.useCase.execute({ ...COMMAND, teamRoleSlug: 'super_admin' }),
    ).rejects.toBeInstanceOf(ProtectedRoleError);
    expect(harness.invitations.insert).not.toHaveBeenCalled();
  });

  it('propagates an above-ceiling rejection and writes nothing', async () => {
    harness.roleAssignments.assertGrantable.mockRejectedValue(
      new EscalationDeniedError(),
    );

    await expect(
      harness.useCase.execute({ ...COMMAND, teamRoleSlug: 'team_admin' }),
    ).rejects.toBeInstanceOf(EscalationDeniedError);
    expect(harness.invitations.insert).not.toHaveBeenCalled();
  });

  it('persists the team scope a team-scoped command carries', async () => {
    harness.invitations.insert.mockResolvedValue({
      ...INSERTED_INVITATION,
      teamId: 'team-1',
    });

    const result = await harness.useCase.execute({
      ...COMMAND,
      teamId: 'team-1',
    });

    expect(harness.invitations.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ teamId: 'team-1' }),
    );
    expect(result.teamId).toBe('team-1');
  });

  it('emails the invitation automatically, with the token it returned', async () => {
    const result = await harness.useCase.execute(COMMAND);

    expect(harness.invitationEmail.send).toHaveBeenCalledTimes(1);
    expect(harness.invitationEmail.send).toHaveBeenCalledWith(result);
    expect(harness.invitationEmail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: INSERTED_INVITATION.email,
        token: 'rawtoken',
      }),
    );
  });

  it('never emails an invitation it refused to create', async () => {
    harness.users.findActiveByEmail.mockResolvedValue(ACTIVE_USER);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationConflictError,
    );
    expect(harness.invitationEmail.send).not.toHaveBeenCalled();
  });

  it('throws a conflict when an active user already exists', async () => {
    harness.users.findActiveByEmail.mockResolvedValue(ACTIVE_USER);

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationConflictError,
    );
    expect(harness.invitations.insert).not.toHaveBeenCalled();
  });

  it('throws a conflict when a pending invitation already exists', async () => {
    harness.invitations.findActivePendingByEmail.mockResolvedValue(
      INSERTED_INVITATION,
    );

    await expect(harness.useCase.execute(COMMAND)).rejects.toBeInstanceOf(
      InvitationConflictError,
    );
    expect(harness.invitations.insert).not.toHaveBeenCalled();
  });
});
