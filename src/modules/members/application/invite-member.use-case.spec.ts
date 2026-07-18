import { ValidationError } from '@core/errors/validation.error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipConflictError } from '../errors/membership-conflict.error';
import { TeamScopeNotFoundError } from '../errors/team-scope-not-found.error';
import { MembershipStatus } from '../model/members.enums';
import type { InviteMemberCommand, Membership } from '../model/members.types';
import { InviteMemberUseCase } from './invite-member.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

const MEMBERSHIP: Membership = {
  id: 'mem-1',
  teamId: 'team-1',
  seasonId: null,
  userId: 'user-1',
  status: MembershipStatus.Invited,
  statusReason: null,
  statusEffectiveAt: NOW,
  joinedAt: null,
  leftAt: null,
  anonymizedAt: null,
  createdBy: 'admin-1',
  updatedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  version: 1,
};

function command(
  overrides: Partial<InviteMemberCommand> = {},
): InviteMemberCommand {
  return {
    userId: 'user-1',
    seasonId: null,
    profile: {
      fullName: 'Ahmed Hassan',
      preferredName: null,
      fullNameAr: null,
      nickname: null,
      email: null,
      phone: null,
      gender: null,
      division: null,
      positions: [],
      jerseyNumber: null,
      jerseySize: null,
      heightCm: null,
      weightKg: null,
      dateOfBirth: null,
    },
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const teamScope = { activeTeamExists: vi.fn().mockResolvedValue(true) };
  const memberships = {
    existsForUserScope: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue(MEMBERSHIP),
  };
  const profiles = { insert: vi.fn().mockResolvedValue({}) };
  const events = { append: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new InviteMemberUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    teamScope,
    memberships as never,
    profiles as never,
    events as never,
    audit,
  );
  return { useCase, teamScope, memberships, profiles, events, audit };
}

describe('InviteMemberUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('rejects a missing or archived team', async () => {
    harness.teamScope.activeTeamExists.mockResolvedValue(false);
    await expect(
      harness.useCase.execute(ACTOR, 'ghost', command()),
    ).rejects.toBeInstanceOf(TeamScopeNotFoundError);
  });

  it('rejects an impossible date of birth', async () => {
    await expect(
      harness.useCase.execute(
        ACTOR,
        'team-1',
        command({
          profile: { ...command().profile, dateOfBirth: '2005-02-30' },
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a duplicate membership for a linked account', async () => {
    harness.memberships.existsForUserScope.mockResolvedValue(true);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', command()),
    ).rejects.toBeInstanceOf(MembershipConflictError);
  });

  it('invites a linked account, writing membership, profile, event, and audit', async () => {
    const result = await harness.useCase.execute(ACTOR, 'team-1', command());
    expect(result).toBe(MEMBERSHIP);
    expect(harness.memberships.insert.mock.calls[0]?.[1]).toMatchObject({
      status: MembershipStatus.Invited,
      createdBy: 'admin-1',
    });
    expect(harness.profiles.insert).toHaveBeenCalledOnce();
    expect(harness.events.append).toHaveBeenCalledOnce();
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('skips the duplicate check for a person with no account', async () => {
    await harness.useCase.execute(ACTOR, 'team-1', command({ userId: null }));
    expect(harness.memberships.existsForUserScope).not.toHaveBeenCalled();
  });
});
