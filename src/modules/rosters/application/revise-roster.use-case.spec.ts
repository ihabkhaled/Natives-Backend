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

import { RosterInvalidTransitionError } from '../errors/roster-invalid-transition.error';
import { RosterVersionConflictError } from '../errors/roster-version-conflict.error';
import type { RosterRepository } from '../infrastructure/roster.repository';
import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import {
  RosterDivision,
  RosterEntryRole,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type { Roster, RosterSnapshot } from '../model/rosters.types';
import { ReviseRosterUseCase } from './revise-roster.use-case';
import type { RosterLookupService } from './roster-lookup.service';
import type { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const IDS = { generate: () => 'roster-2' };
const ACTOR: AuthUserIdentity = {
  userId: 'admin-1',
  email: 'admin@example.test',
  roles: [],
};

function roster(overrides: Partial<Roster> = {}): Roster {
  return {
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    squadId: 'squad-1',
    sourceRosterId: null,
    supersedesRosterId: null,
    currentSnapshotId: 'snap-1',
    rosterKind: RosterKind.Competition,
    name: 'Nationals Roster',
    status: RosterStatus.Locked,
    division: RosterDivision.Mixed,
    minSize: 1,
    maxSize: 30,
    minWomen: null,
    requireCaptain: false,
    policyVersion: 'roster-constraints-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 3,
    createdBy: 'user-1',
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedBy: 'admin-1',
    lockedAt: NOW,
    revisedBy: null,
    revisedAt: null,
    revisionReason: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function snapshot(entryCount: number): RosterSnapshot {
  return {
    snapshotId: 'snap-9',
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    rosterKind: RosterKind.Competition,
    revision: 1,
    reason: SnapshotReason.Revised,
    rosterStatus: RosterStatus.Locked,
    entryCount,
    checksum: 'frozen',
    entries: Array.from({ length: entryCount }, (_unused, index) => ({
      membershipId: `member-${index}`,
      jerseyNumber: index,
      entryRole: RosterEntryRole.Player,
      lineAssignment: RosterLine.Any,
      fieldPosition: RosterPosition.Unspecified,
      genderBucket: RosterGenderBucket.Men,
      availability: null,
      constraintOverridden: false,
    })),
    takenBy: 'admin-1',
    takenAt: NOW,
  };
}

function build(options: {
  existing?: Roster;
  superseded?: Roster | null;
  frozenEntries?: number;
}): {
  useCase: ReviseRosterUseCase;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  events: { enqueue: ReturnType<typeof vi.fn> };
  record: ReturnType<typeof vi.fn>;
  applyStatusChange: ReturnType<typeof vi.fn>;
} {
  const lookup = {
    require: vi.fn().mockResolvedValue(options.existing ?? roster()),
  } as unknown as RosterLookupService;
  const applyStatusChange = vi.fn().mockResolvedValue(
    'superseded' in options
      ? options.superseded
      : roster({
          status: RosterStatus.Revised,
          revisionReason: 'injury replacement',
          revisedBy: 'admin-1',
          revisedAt: NOW,
        }),
  );
  const insert = vi.fn().mockResolvedValue(
    roster({
      rosterId: 'roster-2',
      status: RosterStatus.Draft,
      revision: 2,
      supersedesRosterId: 'roster-1',
      currentSnapshotId: null,
      recordVersion: 1,
    }),
  );
  const rosters = { applyStatusChange, insert } as unknown as RosterRepository;
  const upsert = vi.fn().mockResolvedValue(undefined);
  const entries = { upsert } as unknown as RosterEntryRepository;
  const record = vi
    .fn()
    .mockResolvedValue(snapshot(options.frozenEntries ?? 2));
  const snapshots = { record } as unknown as RosterSnapshotRecorderService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new ReviseRosterUseCase(
      UOW,
      CLOCK,
      IDS,
      lookup,
      rosters,
      entries,
      snapshots,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    insert,
    upsert,
    events,
    record,
    applyStatusChange,
  };
}

describe('ReviseRosterUseCase', () => {
  it('supersedes a locked roster instead of editing it', async () => {
    const { useCase, applyStatusChange, insert, record } = build({});
    const successor = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      reason: 'injury replacement',
      expectedRecordVersion: 3,
    });
    expect(record.mock.calls[0]?.[2]).toBe(SnapshotReason.Revised);
    expect(applyStatusChange.mock.calls[0]?.[1]).toMatchObject({
      toStatus: RosterStatus.Revised,
      revisionReason: 'injury replacement',
      revisedBy: 'admin-1',
      revisedAt: NOW,
    });
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      id: 'roster-2',
      supersedesRosterId: 'roster-1',
      revision: 2,
    });
    expect(successor.rosterId).toBe('roster-2');
    expect(successor.status).toBe(RosterStatus.Draft);
  });

  it('starts the successor from exactly what was frozen, not from the squad', async () => {
    const { useCase, upsert } = build({ frozenEntries: 3 });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      reason: 'injury replacement',
      expectedRecordVersion: 3,
    });
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[0]?.[1]).toMatchObject({
      rosterId: 'roster-2',
      membershipId: 'member-0',
      selectedBy: 'admin-1',
    });
  });

  it('carries an empty snapshot forward without inventing entries', async () => {
    const { useCase, upsert } = build({ frozenEntries: 0 });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      reason: 'restart selection',
      expectedRecordVersion: 3,
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('supersedes a published roster too', async () => {
    const { useCase, insert } = build({
      existing: roster({ status: RosterStatus.Published }),
    });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      reason: 'late withdrawal',
      expectedRecordVersion: 3,
    });
    expect(insert).toHaveBeenCalledOnce();
  });

  it('refuses to revise a draft, an already-revised, or an archived roster', async () => {
    for (const status of [
      RosterStatus.Draft,
      RosterStatus.Revised,
      RosterStatus.Archived,
    ]) {
      const { useCase, record } = build({ existing: roster({ status }) });
      await expect(
        useCase.execute(ACTOR, 'team-1', 'roster-1', {
          reason: 'not allowed',
          expectedRecordVersion: 3,
        }),
      ).rejects.toBeInstanceOf(RosterInvalidTransitionError);
      expect(record).not.toHaveBeenCalled();
    }
  });

  it('raises a version conflict without creating a successor', async () => {
    const { useCase, insert, events } = build({ superseded: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        reason: 'stale',
        expectedRecordVersion: 99,
      }),
    ).rejects.toBeInstanceOf(RosterVersionConflictError);
    expect(insert).not.toHaveBeenCalled();
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues roster.revised pointing at the successor and the snapshot', async () => {
    const { useCase, events } = build({});
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      reason: 'injury replacement',
      expectedRecordVersion: 3,
    });
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'roster.revised.v1',
      aggregateId: 'roster-1',
      payload: {
        snapshotId: 'snap-9',
        successorRosterId: 'roster-2',
        supersededRevision: 1,
      },
    });
  });
});
