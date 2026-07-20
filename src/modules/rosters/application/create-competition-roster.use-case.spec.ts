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
import type { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  RosterDivision,
  RosterGenderBucket,
  RosterKind,
  RosterMemberStatus,
  RosterStatus,
} from '../model/rosters.enums';
import type {
  CompetitionRosterContent,
  Roster,
  RosterCandidate,
} from '../model/rosters.types';
import { CreateCompetitionRosterUseCase } from './create-competition-roster.use-case';
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
  overrides: Partial<CompetitionRosterContent> = {},
): CompetitionRosterContent {
  return {
    competitionId: 'comp-1',
    squadId: null,
    name: 'Nationals Roster',
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: null,
    requireCaptain: true,
    selectionDeadline: null,
    notes: null,
    ...overrides,
  };
}

function created(overrides: Partial<Roster> = {}): Roster {
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

function candidate(overrides: Partial<RosterCandidate> = {}): RosterCandidate {
  return {
    membershipId: 'member-1',
    memberStatus: RosterMemberStatus.Active,
    gender: 'woman',
    jerseyNumber: 11,
    availability: null,
    selectedInSquad: true,
    ...overrides,
  };
}

function build(
  candidates: RosterCandidate[],
  roster: Roster = created(),
): {
  useCase: CreateCompetitionRosterUseCase;
  insertEntry: ReturnType<typeof vi.fn>;
  events: { enqueue: ReturnType<typeof vi.fn> };
  audit: { record: ReturnType<typeof vi.fn> };
  insertRoster: ReturnType<typeof vi.fn>;
} {
  const scope = {
    forCompetition: vi
      .fn()
      .mockResolvedValue({ competitionId: 'comp-1', seasonId: 'season-1' }),
  } as unknown as RosterScopeService;
  const insertRoster = vi.fn().mockResolvedValue(roster);
  const rosters = { insert: insertRoster } as unknown as RosterRepository;
  const insertEntry = vi.fn().mockResolvedValue(undefined);
  const entries = { upsert: insertEntry } as unknown as RosterEntryRepository;
  const source = {
    listSquadSelections: vi.fn().mockResolvedValue(candidates),
  } as unknown as RosterSourceRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const ids = { generate: () => 'generated-id' };
  return {
    useCase: new CreateCompetitionRosterUseCase(
      UOW,
      CLOCK,
      ids,
      scope,
      rosters,
      entries,
      source,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    insertEntry,
    events,
    audit,
    insertRoster,
  };
}

describe('CreateCompetitionRosterUseCase', () => {
  it('creates an empty draft roster when no squad is named', async () => {
    const { useCase, insertEntry, events } = build([]);
    const roster = await useCase.execute(ACTOR, 'team-1', {
      content: content(),
    });
    expect(roster.status).toBe(RosterStatus.Draft);
    expect(insertEntry).not.toHaveBeenCalled();
    expect(events.enqueue.mock.calls[0]?.[1].eventType).toBe(
      'roster.created.v1',
    );
    expect(events.enqueue.mock.calls[0]?.[1].payload.entryCount).toBe(0);
  });

  it('generates the roster from the named squad as a point-in-time copy', async () => {
    const { useCase, insertEntry, events } = build([
      candidate(),
      candidate({ membershipId: 'member-2', jerseyNumber: 12 }),
    ]);
    await useCase.execute(ACTOR, 'team-1', {
      content: content({ squadId: 'squad-1' }),
    });
    expect(insertEntry).toHaveBeenCalledTimes(2);
    expect(insertEntry.mock.calls[0]?.[1]).toMatchObject({
      membershipId: 'member-1',
      jerseyNumber: 11,
      genderBucket: RosterGenderBucket.Women,
      selectedBy: 'user-1',
    });
    expect(events.enqueue.mock.calls[0]?.[1].payload.entryCount).toBe(2);
  });

  it('never fabricates a jersey collision when generating', async () => {
    const { useCase, insertEntry } = build([
      candidate(),
      candidate({ membershipId: 'member-2', jerseyNumber: 11 }),
    ]);
    await useCase.execute(ACTOR, 'team-1', {
      content: content({ squadId: 'squad-1' }),
    });
    expect(insertEntry.mock.calls[0]?.[1].jerseyNumber).toBe(11);
    expect(insertEntry.mock.calls[1]?.[1].jerseyNumber).toBeNull();
  });

  it('records the audit entry alongside the created event', async () => {
    const { useCase, audit } = build([]);
    await useCase.execute(ACTOR, 'team-1', { content: content() });
    expect(audit.record.mock.calls[0]?.[1].action).toBe('roster.created');
  });

  it('rejects an impossible size window before anything is written', async () => {
    const { useCase, insertRoster } = build([]);
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: content({ minSize: 20, maxSize: 10 }),
      }),
    ).rejects.toBeInstanceOf(RosterValidationError);
    expect(insertRoster).not.toHaveBeenCalled();
  });

  it('rejects an unreachable minimum-women rule', async () => {
    const { useCase } = build([]);
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: content({ minWomen: 99, maxSize: 20 }),
      }),
    ).rejects.toBeInstanceOf(RosterValidationError);
  });
});
