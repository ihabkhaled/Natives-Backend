import { describe, expect, it, vi } from 'vitest';

import { InvalidTransitionError } from '../errors/invalid-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { MembershipStatus } from '../model/members.enums';
import type { Membership } from '../model/members.types';
import { TransitionMemberUseCase } from './transition-member.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
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
    ...overrides,
  };
}

function build(current: Membership, applied: Membership | null) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const lookup = { requireMembership: vi.fn().mockResolvedValue(current) };
  const memberships = {
    applyStatusChange: vi.fn().mockResolvedValue(applied),
  };
  const events = { append: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new TransitionMemberUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    memberships as never,
    events as never,
    audit,
  );
  return { useCase, memberships, events, audit };
}

describe('TransitionMemberUseCase', () => {
  it('rejects a disallowed transition', async () => {
    const { useCase } = build(
      membership({ status: MembershipStatus.Anonymized }),
      null,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', MembershipStatus.Active, {
        reason: null,
        effectiveAt: null,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('reports an optimistic conflict when the row changed', async () => {
    const { useCase } = build(membership(), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', MembershipStatus.Active, {
        reason: null,
        effectiveAt: null,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('activates an invited member, setting joined_at to the effective time', async () => {
    const activated = membership({ status: MembershipStatus.Active });
    const { useCase, memberships, events, audit } = build(
      membership(),
      activated,
    );
    const result = await useCase.execute(
      ACTOR,
      'team-1',
      'mem-1',
      MembershipStatus.Active,
      { reason: 'accepted', effectiveAt: '2026-06-02T00:00:00.000Z' },
    );
    expect(result).toBe(activated);
    const change = memberships.applyStatusChange.mock.calls[0]?.[1];
    expect(change.joinedAt).toEqual(new Date('2026-06-02T00:00:00.000Z'));
    expect(change.leftAt).toBeNull();
    expect(events.append).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledOnce();
  });

  it('stamps left_at when leaving and defaults the effective time to now', async () => {
    const left = membership({ status: MembershipStatus.Left });
    const { useCase, memberships } = build(
      membership({ status: MembershipStatus.Active, joinedAt: NOW }),
      left,
    );
    await useCase.execute(ACTOR, 'team-1', 'mem-1', MembershipStatus.Left, {
      reason: null,
      effectiveAt: null,
    });
    const change = memberships.applyStatusChange.mock.calls[0]?.[1];
    expect(change.leftAt).toEqual(NOW);
    expect(change.joinedAt).toEqual(NOW);
  });
});
