import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { RosterAvailabilityMembershipNotFoundError } from '../errors/roster-availability-membership-not-found.error';
import { RosterLockedError } from '../errors/roster-locked.error';
import type { RosterAvailabilityRepository } from '../infrastructure/roster-availability.repository';
import type { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
  RosterDivision,
  RosterKind,
  RosterStatus,
} from '../model/rosters.enums';
import type { Roster, RosterAvailabilityRecord } from '../model/rosters.types';
import { DeclareRosterAvailabilityUseCase } from './declare-roster-availability.use-case';
import type { RosterLookupService } from './roster-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const PASSED = new Date('2026-02-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const IDS = { generate: () => 'av-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'player@example.test',
  roles: [],
};

function roster(overrides: Partial<Roster> = {}): Roster {
  return {
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    squadId: null,
    sourceRosterId: null,
    supersedesRosterId: null,
    currentSnapshotId: null,
    rosterKind: RosterKind.Competition,
    name: 'Nationals Roster',
    status: RosterStatus.Published,
    division: RosterDivision.Mixed,
    minSize: 1,
    maxSize: 30,
    minWomen: null,
    requireCaptain: false,
    policyVersion: 'roster-constraints-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 1,
    createdBy: 'user-1',
    publishedBy: null,
    publishedAt: null,
    lockedBy: null,
    lockedAt: null,
    revisedBy: null,
    revisedAt: null,
    revisionReason: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function declared(): RosterAvailabilityRecord {
  return {
    availabilityId: 'av-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'membership-1',
    availability: RosterAvailabilityStatus.Unavailable,
    reason: 'exams',
    source: RosterAvailabilitySource.Self,
    declaredBy: 'user-1',
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(options: { roster?: Roster; membershipId?: string | null }): {
  useCase: DeclareRosterAvailabilityUseCase;
  upsert: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(options.roster ?? roster()),
  } as unknown as RosterLookupService;
  const source = {
    resolveActiveMembership: vi
      .fn()
      .mockResolvedValue(
        'membershipId' in options ? options.membershipId : 'membership-1',
      ),
  } as unknown as RosterSourceRepository;
  const upsert = vi.fn().mockResolvedValue(declared());
  const availability = { upsert } as unknown as RosterAvailabilityRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new DeclareRosterAvailabilityUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup,
      source,
      availability,
      audit as unknown as AuditRecorderService,
    ),
    upsert,
    audit,
  };
}

describe('DeclareRosterAvailabilityUseCase', () => {
  it('records the declaration against the membership on the token', async () => {
    const { useCase, upsert, audit } = build({});
    const record = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      availability: RosterAvailabilityStatus.Unavailable,
      reason: 'exams',
    });
    expect(record.membershipId).toBe('membership-1');
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({
      membershipId: 'membership-1',
      availability: RosterAvailabilityStatus.Unavailable,
      source: RosterAvailabilitySource.Self,
      declaredBy: 'user-1',
    });
    expect(audit.record.mock.calls[0]?.[1].action).toBe(
      'roster.availability.declared',
    );
  });

  it('accepts a declaration while the roster is still a draft', async () => {
    const { useCase, upsert } = build({
      roster: roster({ status: RosterStatus.Draft }),
    });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      availability: RosterAvailabilityStatus.Available,
      reason: null,
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('closes the window once the roster is frozen', async () => {
    const { useCase, upsert } = build({
      roster: roster({ status: RosterStatus.Locked }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        availability: RosterAvailabilityStatus.Available,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(RosterLockedError);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('closes the window once the selection deadline has passed', async () => {
    const { useCase } = build({
      roster: roster({ selectionDeadline: PASSED }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        availability: RosterAvailabilityStatus.Available,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(RosterLockedError);
  });

  it('refuses a principal with no membership in this team and season', async () => {
    const { useCase, upsert } = build({ membershipId: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        availability: RosterAvailabilityStatus.Available,
        reason: null,
      }),
    ).rejects.toBeInstanceOf(RosterAvailabilityMembershipNotFoundError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
