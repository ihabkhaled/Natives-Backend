import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InvitationStatus } from '../model/identity.enums';
import type {
  InvitationRow,
  PublicInvitationRow,
} from '../model/identity.rows';
import { InvitationRepository } from './invitation.repository';

function createScope(): { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() };
}

const INVITATION_ROW: InvitationRow = {
  id: 'inv-1',
  email: 'invitee@example.test',
  invited_by: 'user-1',
  role: 'admin',
  team_id: null,
  team_role_key: 'MEMBER',
  status: 'pending',
  expires_at: '2026-01-10T00:00:00.000Z',
  accepted_at: null,
  revoked_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

const PUBLIC_INVITATION_ROW: PublicInvitationRow = {
  ...INVITATION_ROW,
  inviter_display_name: 'Coach One',
  team_name: null,
};

describe('InvitationRepository', () => {
  let repository: InvitationRepository;
  let scope: { run: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = new InvitationRepository();
    scope = createScope();
  });

  it('inserts an invitation and returns the persisted aggregate', async () => {
    scope.run.mockResolvedValue([INVITATION_ROW]);
    const expiresAt = new Date('2026-01-10T00:00:00.000Z');
    const now = new Date('2026-01-01T00:00:00.000Z');

    const invitation = await repository.insert(
      scope as unknown as TransactionScope,
      {
        id: 'inv-1',
        email: 'invitee@example.test',
        tokenHash: 'hash-1',
        invitedBy: 'user-1',
        role: Role.Admin,
        teamId: null,
        teamRoleKey: 'MEMBER',
        expiresAt,
        now,
      },
    );

    expect(invitation).toEqual({
      id: 'inv-1',
      email: 'invitee@example.test',
      invitedBy: 'user-1',
      role: Role.Admin,
      teamId: null,
      teamRoleKey: 'MEMBER',
      status: InvitationStatus.Pending,
      expiresAt: new Date('2026-01-10T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO "invitations"');
    expect(params).toEqual([
      'inv-1',
      'invitee@example.test',
      'hash-1',
      'user-1',
      Role.Admin,
      null,
      'MEMBER',
      InvitationStatus.Pending,
      expiresAt.toISOString(),
      now.toISOString(),
    ]);
  });

  it('persists and maps a team-scoped invitation', async () => {
    scope.run.mockResolvedValue([{ ...INVITATION_ROW, team_id: 'team-1' }]);

    const invitation = await repository.insert(
      scope as unknown as TransactionScope,
      {
        id: 'inv-1',
        email: 'invitee@example.test',
        tokenHash: 'hash-1',
        invitedBy: 'user-1',
        role: Role.User,
        teamId: 'team-1',
        teamRoleKey: 'COACH',
        expiresAt: new Date('2026-01-10T00:00:00.000Z'),
        now: new Date('2026-01-01T00:00:00.000Z'),
      },
    );

    expect(invitation.teamId).toBe('team-1');
    const [, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(params[5]).toBe('team-1');
  });

  it('maps a found invitation by id', async () => {
    scope.run.mockResolvedValue([INVITATION_ROW]);

    const invitation = await repository.findById(
      scope as unknown as TransactionScope,
      'inv-1',
    );

    expect(invitation?.id).toBe('inv-1');
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM "invitations"');
    expect(params).toEqual(['inv-1']);
  });

  it('returns null when no invitation matches by id', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findById(scope as unknown as TransactionScope, 'missing'),
    ).resolves.toBeNull();
  });

  it('locks the invitation row when looking up by token hash', async () => {
    scope.run.mockResolvedValue([INVITATION_ROW]);

    const invitation = await repository.findByTokenHashForUpdate(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(invitation?.id).toBe('inv-1');
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FOR UPDATE');
    expect(params).toEqual(['hash-1']);
  });

  it('returns null when no invitation matches by token hash', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findByTokenHashForUpdate(
        scope as unknown as TransactionScope,
        'missing',
      ),
    ).resolves.toBeNull();
  });

  it('finds public invitation details by token hash without returning the hash', async () => {
    scope.run.mockResolvedValue([PUBLIC_INVITATION_ROW]);

    const invitation = await repository.findPublicByTokenHash(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(invitation).toMatchObject({
      id: 'inv-1',
      email: 'invitee@example.test',
      inviterName: 'Coach One',
    });
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LEFT JOIN "users"');
    expect(sql).not.toContain('"token_hash",');
    expect(params).toEqual(['hash-1']);
  });

  it('returns null when a public invitation token does not match', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findPublicByTokenHash(
        scope as unknown as TransactionScope,
        'missing',
      ),
    ).resolves.toBeNull();
  });

  it('maps an absent inviter display name to null', async () => {
    scope.run.mockResolvedValue([
      { ...PUBLIC_INVITATION_ROW, inviter_display_name: null },
    ]);

    const invitation = await repository.findPublicByTokenHash(
      scope as unknown as TransactionScope,
      'hash-1',
    );

    expect(invitation?.inviterName).toBeNull();
  });

  it('finds an active pending invitation by normalized email', async () => {
    scope.run.mockResolvedValue([INVITATION_ROW]);

    const invitation = await repository.findActivePendingByEmail(
      scope as unknown as TransactionScope,
      'invitee@example.test',
    );

    expect(invitation?.id).toBe('inv-1');
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('lower("email")');
    expect(params).toEqual(['invitee@example.test', InvitationStatus.Pending]);
  });

  it('returns null when no active pending invitation matches by email', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.findActivePendingByEmail(
        scope as unknown as TransactionScope,
        'nobody@example.test',
      ),
    ).resolves.toBeNull();
  });

  it('marks an invitation accepted', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-03T00:00:00.000Z');

    await repository.markAccepted(
      scope as unknown as TransactionScope,
      'inv-1',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "invitations"');
    expect(params).toEqual([
      'inv-1',
      InvitationStatus.Accepted,
      now.toISOString(),
    ]);
  });

  it('marks an invitation revoked', async () => {
    scope.run.mockResolvedValue([]);
    const now = new Date('2026-01-03T00:00:00.000Z');

    await repository.markRevoked(
      scope as unknown as TransactionScope,
      'inv-1',
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "invitations"');
    expect(params).toEqual([
      'inv-1',
      InvitationStatus.Revoked,
      now.toISOString(),
    ]);
  });

  it('rotates the invitation token', async () => {
    scope.run.mockResolvedValue([]);
    const expiresAt = new Date('2026-02-01T00:00:00.000Z');
    const now = new Date('2026-01-03T00:00:00.000Z');

    await repository.rotateToken(
      scope as unknown as TransactionScope,
      'inv-1',
      'hash-2',
      expiresAt,
      now,
    );

    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "invitations"');
    expect(params).toEqual([
      'inv-1',
      'hash-2',
      expiresAt.toISOString(),
      InvitationStatus.Pending,
      now.toISOString(),
    ]);
  });

  it('expires overdue invitations and returns the affected count', async () => {
    scope.run.mockResolvedValue([INVITATION_ROW, INVITATION_ROW]);
    const now = new Date('2026-01-15T00:00:00.000Z');

    const count = await repository.expireOverdue(
      scope as unknown as TransactionScope,
      now,
    );

    expect(count).toBe(2);
    const [sql, params] = scope.run.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE "invitations"');
    expect(params).toEqual([
      InvitationStatus.Expired,
      now.toISOString(),
      InvitationStatus.Pending,
    ]);
  });

  it('returns zero when no overdue invitations are expired', async () => {
    scope.run.mockResolvedValue([]);

    await expect(
      repository.expireOverdue(
        scope as unknown as TransactionScope,
        new Date('2026-01-15T00:00:00.000Z'),
      ),
    ).resolves.toBe(0);
  });

  it('maps accepted and revoked timestamps when present', async () => {
    const row: InvitationRow = {
      ...INVITATION_ROW,
      status: 'accepted',
      accepted_at: '2026-01-05T00:00:00.000Z',
      revoked_at: '2026-01-06T00:00:00.000Z',
    };
    scope.run.mockResolvedValue([row]);

    const invitation = await repository.findById(
      scope as unknown as TransactionScope,
      'inv-1',
    );

    expect(invitation?.status).toBe(InvitationStatus.Accepted);
    expect(invitation?.acceptedAt).toEqual(
      new Date('2026-01-05T00:00:00.000Z'),
    );
    expect(invitation?.revokedAt).toEqual(new Date('2026-01-06T00:00:00.000Z'));
  });

  it('maps a null invited_by into the domain aggregate', async () => {
    const row: InvitationRow = { ...INVITATION_ROW, invited_by: null };
    scope.run.mockResolvedValue([row]);

    const invitation = await repository.findById(
      scope as unknown as TransactionScope,
      'inv-1',
    );

    expect(invitation?.invitedBy).toBeNull();
  });
});
