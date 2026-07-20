import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { RosterEntryNotFoundError } from '../errors/roster-entry-not-found.error';
import { RosterLockedError } from '../errors/roster-locked.error';
import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import {
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
} from '../model/rosters.enums';
import type { Roster, RosterEntry } from '../model/rosters.types';
import { RemoveRosterEntryUseCase } from './remove-roster-entry.use-case';
import type { RosterLookupService } from './roster-lookup.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'coach@example.test',
  roles: [],
};

function roster(status: RosterStatus = RosterStatus.Draft): Roster {
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
    status,
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
  };
}

function withdrawn(): RosterEntry {
  return {
    entryId: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    jerseyNumber: 7,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    genderBucket: RosterGenderBucket.Men,
    status: RosterEntryStatus.Withdrawn,
    availability: null,
    selectionReason: null,
    constraintOverridden: true,
    overrideReason: 'was accepted earlier',
    overriddenBy: 'user-2',
    selectedBy: 'user-1',
    removedBy: 'user-1',
    removedAt: NOW,
    removalReason: 'travelling',
    recordVersion: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(options: {
  status?: RosterStatus;
  removed?: RosterEntry | null;
}): {
  useCase: RemoveRosterEntryUseCase;
  softRemove: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(roster(options.status)),
  } as unknown as RosterLookupService;
  const softRemove = vi
    .fn()
    .mockResolvedValue('removed' in options ? options.removed : withdrawn());
  const entries = { softRemove } as unknown as RosterEntryRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new RemoveRosterEntryUseCase(
      UOW,
      CLOCK,
      lookup,
      entries,
      audit as unknown as AuditRecorderService,
    ),
    softRemove,
    audit,
  };
}

describe('RemoveRosterEntryUseCase', () => {
  it('withdraws the entry, keeping it and its override evidence', async () => {
    const { useCase, softRemove, audit } = build({});
    const entry = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      membershipId: 'member-1',
      reason: 'travelling',
    });
    expect(entry.status).toBe(RosterEntryStatus.Withdrawn);
    expect(entry.overrideReason).toBe('was accepted earlier');
    expect(softRemove.mock.calls[0]?.[1]).toEqual({
      rosterId: 'roster-1',
      membershipId: 'member-1',
      removedBy: 'user-1',
      reason: 'travelling',
      now: NOW,
    });
    expect(audit.record.mock.calls[0]?.[1].action).toBe('roster.entry.removed');
  });

  it('refuses to change a frozen roster', async () => {
    const { useCase, softRemove } = build({ status: RosterStatus.Locked });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        membershipId: 'member-1',
        reason: null,
      }),
    ).rejects.toBeInstanceOf(RosterLockedError);
    expect(softRemove).not.toHaveBeenCalled();
  });

  it('reports a player who is not on the roster as not found', async () => {
    const { useCase, audit } = build({ removed: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        membershipId: 'member-9',
        reason: null,
      }),
    ).rejects.toBeInstanceOf(RosterEntryNotFoundError);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
