import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityMembershipNotFoundError } from '../errors/availability-membership-not-found.error';
import { SquadAvailabilityRepository } from '../infrastructure/squad-availability.repository';
import { SquadEligibilityRepository } from '../infrastructure/squad-eligibility.repository';
import {
  AvailabilitySource,
  AvailabilityStatus,
  SquadStatus,
} from '../model/squads.enums';
import type { Availability, Squad } from '../model/squads.types';
import { DeclareAvailabilityUseCase } from './declare-availability.use-case';
import type { SquadLookupService } from './squad-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-02-01T12:00:00.000Z');
const UOW: UnitOfWorkPort = { runInTransaction: op => op(TX) };
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'gen-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-3',
  email: 'p@x.test',
  roles: [],
};

function squad(): Squad {
  return {
    squadId: 'squad-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: null,
    name: 'Squad',
    status: SquadStatus.Published,
    attendanceThresholdPct: 70,
    policyVersion: 'eligibility-signals-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 1,
    createdBy: 'user-1',
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function declared(): Availability {
  return {
    availabilityId: 'av-1',
    squadId: 'squad-1',
    teamId: 'team-1',
    membershipId: 'm-9',
    availability: AvailabilityStatus.Unavailable,
    reason: 'travelling',
    source: AvailabilitySource.Self,
    declaredBy: 'user-3',
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(membershipId: string | null): {
  useCase: DeclareAvailabilityUseCase;
  availability: { upsert: ReturnType<typeof vi.fn> };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(squad()),
  } as unknown as SquadLookupService;
  const eligibility = {
    resolveActiveMembership: vi.fn().mockResolvedValue(membershipId),
  } as unknown as SquadEligibilityRepository;
  const availability = {
    upsert: vi.fn().mockResolvedValue(declared()),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new DeclareAvailabilityUseCase(
    UOW,
    CLOCK,
    ID_GEN,
    lookup,
    eligibility,
    availability as unknown as SquadAvailabilityRepository,
    audit as unknown as AuditRecorderService,
  );
  return { useCase, availability };
}

describe('DeclareAvailabilityUseCase', () => {
  it('resolves the caller membership from the token and upserts availability', async () => {
    const { useCase, availability } = build('m-9');
    const result = await useCase.execute(ACTOR, 'team-1', 'squad-1', {
      availability: AvailabilityStatus.Unavailable,
      reason: 'travelling',
    });
    expect(result.membershipId).toBe('m-9');
    expect(availability.upsert.mock.calls[0]?.[1].membershipId).toBe('m-9');
    expect(availability.upsert.mock.calls[0]?.[1].source).toBe(
      AvailabilitySource.Self,
    );
  });

  it('rejects a principal with no active membership in the team and season', async () => {
    const { useCase } = build(null);
    await expect(
      useCase.execute(ACTOR, 'team-1', 'squad-1', {
        availability: AvailabilityStatus.Available,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(AvailabilityMembershipNotFoundError);
  });
});
