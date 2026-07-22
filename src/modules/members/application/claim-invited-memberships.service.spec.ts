import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MembershipStatus } from '../model/members.enums';
import type { Membership } from '../model/members.types';
import { ClaimInvitedMembershipsService } from './claim-invited-memberships.service';

const NOW = new Date('2026-07-01T12:00:00.000Z');

function invitedMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'mem-1',
    teamId: 'team-1',
    seasonId: null,
    userId: null,
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
    ...overrides,
  };
}

const COMMAND = {
  email: 'invitee@example.test',
  teamId: null,
  userId: 'user-9',
  now: NOW,
};

function build() {
  const scope = { run: vi.fn() };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated-id') };
  const memberships = {
    listInvitedUnlinkedByEmail: vi.fn().mockResolvedValue([]),
    existsForUserScope: vi.fn().mockResolvedValue(false),
    linkUserAndActivate: vi.fn(),
  };
  const events = { append: vi.fn() };
  const audit = { append: vi.fn() };
  const service = new ClaimInvitedMembershipsService(
    idGenerator,
    memberships as never,
    events as never,
    audit,
  );
  return { scope, service, memberships, events, audit };
}

describe('ClaimInvitedMembershipsService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('links, activates, records the status event and audits each claimed membership', async () => {
    const membership = invitedMembership();
    harness.memberships.listInvitedUnlinkedByEmail.mockResolvedValue([
      membership,
    ]);
    harness.memberships.linkUserAndActivate.mockResolvedValue({
      ...membership,
      userId: 'user-9',
      status: MembershipStatus.Active,
      joinedAt: NOW,
      version: 2,
    });

    const claimed = await harness.service.claim(
      harness.scope as never,
      COMMAND,
    );

    expect(claimed).toEqual([
      { membershipId: 'mem-1', teamId: 'team-1', seasonId: null },
    ]);
    expect(harness.memberships.linkUserAndActivate).toHaveBeenCalledWith(
      harness.scope,
      {
        id: 'mem-1',
        userId: 'user-9',
        statusEffectiveAt: NOW,
        expectedVersion: 1,
        now: NOW,
      },
    );
    expect(harness.events.append).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        membershipId: 'mem-1',
        fromStatus: MembershipStatus.Invited,
        toStatus: MembershipStatus.Active,
        actorUserId: 'user-9',
      }),
    );
    expect(harness.audit.append).toHaveBeenCalledWith(
      harness.scope,
      expect.objectContaining({
        eventType: 'member.accountLinked',
        actorUserId: 'user-9',
        context: expect.objectContaining({
          membershipId: 'mem-1',
          teamId: 'team-1',
        }),
      }),
    );
  });

  it('passes the team restriction through to the membership lookup', async () => {
    await harness.service.claim(harness.scope as never, {
      ...COMMAND,
      teamId: 'team-7',
    });

    expect(harness.memberships.listInvitedUnlinkedByEmail).toHaveBeenCalledWith(
      harness.scope,
      'invitee@example.test',
      'team-7',
    );
  });

  it('returns an empty list when nothing matches and writes nothing', async () => {
    const claimed = await harness.service.claim(
      harness.scope as never,
      COMMAND,
    );

    expect(claimed).toEqual([]);
    expect(harness.memberships.linkUserAndActivate).not.toHaveBeenCalled();
    expect(harness.events.append).not.toHaveBeenCalled();
    expect(harness.audit.append).not.toHaveBeenCalled();
  });

  it('skips a membership when the user already holds one in that scope', async () => {
    harness.memberships.listInvitedUnlinkedByEmail.mockResolvedValue([
      invitedMembership(),
    ]);
    harness.memberships.existsForUserScope.mockResolvedValue(true);

    const claimed = await harness.service.claim(
      harness.scope as never,
      COMMAND,
    );

    expect(claimed).toEqual([]);
    expect(harness.memberships.linkUserAndActivate).not.toHaveBeenCalled();
  });

  it('skips a membership whose lifecycle no longer allows activation', async () => {
    harness.memberships.listInvitedUnlinkedByEmail.mockResolvedValue([
      invitedMembership({ status: MembershipStatus.Anonymized }),
    ]);

    const claimed = await harness.service.claim(
      harness.scope as never,
      COMMAND,
    );

    expect(claimed).toEqual([]);
    expect(harness.memberships.existsForUserScope).not.toHaveBeenCalled();
    expect(harness.memberships.linkUserAndActivate).not.toHaveBeenCalled();
  });

  it('skips a membership whose guarded update reports it moved on', async () => {
    harness.memberships.listInvitedUnlinkedByEmail.mockResolvedValue([
      invitedMembership(),
    ]);
    harness.memberships.linkUserAndActivate.mockResolvedValue(null);

    const claimed = await harness.service.claim(
      harness.scope as never,
      COMMAND,
    );

    expect(claimed).toEqual([]);
    expect(harness.events.append).not.toHaveBeenCalled();
    expect(harness.audit.append).not.toHaveBeenCalled();
  });

  it('claims multiple invited memberships across teams', async () => {
    const first = invitedMembership();
    const second = invitedMembership({ id: 'mem-2', teamId: 'team-2' });
    harness.memberships.listInvitedUnlinkedByEmail.mockResolvedValue([
      first,
      second,
    ]);
    harness.memberships.linkUserAndActivate.mockImplementation(
      (_scope: unknown, claim: { id: string }) =>
        Promise.resolve({
          ...(claim.id === 'mem-1' ? first : second),
          userId: 'user-9',
          status: MembershipStatus.Active,
          version: 2,
        }),
    );

    const claimed = await harness.service.claim(
      harness.scope as never,
      COMMAND,
    );

    expect(claimed).toEqual([
      { membershipId: 'mem-1', teamId: 'team-1', seasonId: null },
      { membershipId: 'mem-2', teamId: 'team-2', seasonId: null },
    ]);
    expect(harness.events.append).toHaveBeenCalledTimes(2);
    expect(harness.audit.append).toHaveBeenCalledTimes(2);
  });
});
