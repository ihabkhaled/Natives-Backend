import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { RosterValidationError } from '../errors/roster-validation.error';
import type { RosterRepository } from '../infrastructure/roster.repository';
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
import type {
  MatchRosterContent,
  Roster,
  RosterEntry,
} from '../model/rosters.types';
import { CreateMatchRosterUseCase } from './create-match-roster.use-case';
import type { RosterLookupService } from './roster-lookup.service';
import type { RosterScopeService } from './roster-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'coach@example.test',
  roles: [],
};

function content(
  overrides: Partial<MatchRosterContent> = {},
): MatchRosterContent {
  return {
    fixtureId: 'fixture-1',
    sourceRosterId: null,
    name: 'Game 1',
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: null,
    requireCaptain: true,
    notes: null,
    ...overrides,
  };
}

function roster(overrides: Partial<Roster> = {}): Roster {
  return {
    rosterId: 'roster-2',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    squadId: null,
    sourceRosterId: null,
    supersedesRosterId: null,
    currentSnapshotId: null,
    rosterKind: RosterKind.Match,
    name: 'Game 1',
    status: RosterStatus.Draft,
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: null,
    requireCaptain: true,
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

function entry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    entryId: 'entry-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    membershipId: 'member-1',
    jerseyNumber: 7,
    entryRole: RosterEntryRole.Captain,
    lineAssignment: RosterLine.Offense,
    fieldPosition: RosterPosition.Handler,
    genderBucket: RosterGenderBucket.Women,
    status: RosterEntryStatus.Selected,
    availability: null,
    selectionReason: 'ignored on copy',
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: 'user-9',
    removedBy: null,
    removedAt: null,
    removalReason: null,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function build(sourceEntries: RosterEntry[]): {
  useCase: CreateMatchRosterUseCase;
  upsert: ReturnType<typeof vi.fn>;
  events: { enqueue: ReturnType<typeof vi.fn> };
} {
  const scope = {
    forFixture: vi
      .fn()
      .mockResolvedValue({ competitionId: 'comp-1', seasonId: 'season-1' }),
  } as unknown as RosterScopeService;
  const lookup = {
    require: vi
      .fn()
      .mockResolvedValue(
        roster({ rosterId: 'roster-1', rosterKind: RosterKind.Competition }),
      ),
  } as unknown as RosterLookupService;
  const rosters = {
    insert: vi.fn().mockResolvedValue(roster()),
  } as unknown as RosterRepository;
  const upsert = vi.fn().mockResolvedValue(undefined);
  const entries = {
    upsert,
    listActive: vi.fn().mockResolvedValue(sourceEntries),
  } as unknown as RosterEntryRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const ids = { generate: () => 'generated-id' };
  return {
    useCase: new CreateMatchRosterUseCase(
      UOW,
      CLOCK,
      ids,
      scope,
      lookup,
      rosters,
      entries,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    upsert,
    events,
  };
}

describe('CreateMatchRosterUseCase', () => {
  it('creates an empty draft match roster when no source is named', async () => {
    const { useCase, upsert, events } = build([]);
    const created = await useCase.execute(ACTOR, 'team-1', {
      content: content(),
    });
    expect(created.rosterKind).toBe(RosterKind.Match);
    expect(created.fixtureId).toBe('fixture-1');
    expect(upsert).not.toHaveBeenCalled();
    expect(events.enqueue.mock.calls[0]?.[1].payload.entryCount).toBe(0);
  });

  it('copies the source roster’s active entries as they stand right now', async () => {
    const { useCase, upsert, events } = build([
      entry(),
      entry({ entryId: 'entry-2', membershipId: 'member-2', jerseyNumber: 8 }),
    ]);
    await useCase.execute(ACTOR, 'team-1', {
      content: content({ sourceRosterId: 'roster-1' }),
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({
      rosterId: 'roster-2',
      membershipId: 'member-1',
      entryRole: RosterEntryRole.Captain,
      lineAssignment: RosterLine.Offense,
      fieldPosition: RosterPosition.Handler,
      genderBucket: RosterGenderBucket.Women,
      selectedBy: 'user-1',
    });
    expect(events.enqueue.mock.calls[0]?.[1].payload.entryCount).toBe(2);
  });

  it('never copies a withdrawn entry from the source roster', async () => {
    const { useCase, upsert } = build([
      entry(),
      entry({
        entryId: 'entry-2',
        membershipId: 'member-2',
        jerseyNumber: 8,
        status: RosterEntryStatus.Withdrawn,
      }),
    ]);
    await useCase.execute(ACTOR, 'team-1', {
      content: content({ sourceRosterId: 'roster-1' }),
    });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('rejects an impossible size window before anything is written', async () => {
    const { useCase, upsert } = build([]);
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: content({ minSize: 0 }),
      }),
    ).rejects.toBeInstanceOf(RosterValidationError);
    expect(upsert).not.toHaveBeenCalled();
  });
});
