import { describe, expect, it, vi } from 'vitest';

import { InvalidTransitionError } from '../errors/invalid-transition.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { MembershipStatus } from '../model/members.enums';
import type { Membership } from '../model/members.types';
import { AnonymizeMemberUseCase } from './anonymize-member.use-case';

const SCOPE = {} as never;
const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'mem-1',
    teamId: 'team-1',
    seasonId: null,
    userId: 'user-1',
    status: MembershipStatus.Active,
    statusReason: null,
    statusEffectiveAt: NOW,
    joinedAt: NOW,
    leftAt: null,
    anonymizedAt: null,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 3,
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
  const memberships = { applyStatusChange: vi.fn().mockResolvedValue(applied) };
  const profiles = { redact: vi.fn() };
  const aliases = { softDeleteAllForMembership: vi.fn() };
  const events = { append: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new AnonymizeMemberUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    lookup as never,
    memberships as never,
    profiles as never,
    aliases as never,
    events as never,
    audit,
  );
  return { useCase, memberships, profiles, aliases, events, audit };
}

describe('AnonymizeMemberUseCase', () => {
  it('rejects anonymizing an already anonymized member', async () => {
    const { useCase } = build(
      membership({ status: MembershipStatus.Anonymized }),
      null,
    );
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', {
        reason: null,
        effectiveAt: null,
      }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });

  it('reports an optimistic conflict', async () => {
    const { useCase } = build(membership(), null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'mem-1', {
        reason: null,
        effectiveAt: null,
      }),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('anonymizes, redacting the profile and removing aliases', async () => {
    const anonymized = membership({ status: MembershipStatus.Anonymized });
    const { useCase, profiles, aliases, events, audit } = build(
      membership(),
      anonymized,
    );
    const result = await useCase.execute(ACTOR, 'team-1', 'mem-1', {
      reason: 'GDPR request',
      effectiveAt: null,
    });
    expect(result).toBe(anonymized);
    expect(profiles.redact).toHaveBeenCalledOnce();
    expect(aliases.softDeleteAllForMembership).toHaveBeenCalledWith(
      SCOPE,
      'mem-1',
      NOW,
    );
    expect(events.append).toHaveBeenCalledOnce();
    expect(audit.append).toHaveBeenCalledOnce();
  });
});
