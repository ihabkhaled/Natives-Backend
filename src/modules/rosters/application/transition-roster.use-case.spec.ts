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

import { RosterConstraintError } from '../errors/roster-constraint.error';
import { RosterInvalidTransitionError } from '../errors/roster-invalid-transition.error';
import { RosterVersionConflictError } from '../errors/roster-version-conflict.error';
import type { RosterRepository } from '../infrastructure/roster.repository';
import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import type { RosterSourceRepository } from '../infrastructure/roster-source.repository';
import {
  RosterAudience,
  RosterDivision,
  RosterKind,
  RosterStatus,
  RosterTransition,
  SnapshotReason,
} from '../model/rosters.enums';
import type { Roster, RosterSnapshot } from '../model/rosters.types';
import type { RosterLookupService } from './roster-lookup.service';
import type { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';
import type { RosterValidationService } from './roster-validation.service';
import { TransitionRosterUseCase } from './transition-roster.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'coach@example.test',
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
    status: RosterStatus.Draft,
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

function snapshot(): RosterSnapshot {
  return {
    snapshotId: 'snap-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    rosterKind: RosterKind.Competition,
    revision: 1,
    reason: SnapshotReason.Published,
    rosterStatus: RosterStatus.Published,
    entryCount: 14,
    checksum: 'abc',
    entries: [],
    takenBy: 'user-1',
    takenAt: NOW,
  };
}

function build(options: {
  existing?: Roster;
  changed?: Roster | null;
  publishable?: boolean;
  selected?: number;
  notSelected?: number;
}): {
  useCase: TransitionRosterUseCase;
  events: { enqueue: ReturnType<typeof vi.fn> };
  record: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const changed =
    'changed' in options
      ? options.changed
      : roster({ status: RosterStatus.Published });
  const lookup = {
    // The first read resolves the roster to transition; a publish re-reads it
    // afterwards so the response carries the snapshot it just froze.
    require: vi
      .fn()
      .mockResolvedValueOnce(options.existing ?? roster())
      .mockResolvedValue(
        changed === null
          ? roster()
          : { ...changed, currentSnapshotId: 'snap-1' },
      ),
  } as unknown as RosterLookupService;
  const rosters = {
    applyStatusChange: vi.fn().mockResolvedValue(changed),
  } as unknown as RosterRepository;
  const entries = {
    countActive: vi.fn().mockResolvedValue(options.selected ?? 14),
  } as unknown as RosterEntryRepository;
  const source = {
    countNotSelected: vi.fn().mockResolvedValue(options.notSelected ?? 6),
  } as unknown as RosterSourceRepository;
  const validation = {
    assertPublishable: vi.fn().mockImplementation(() => {
      if (options.publishable === false) {
        throw new RosterConstraintError();
      }
      return Promise.resolve(undefined);
    }),
  } as unknown as RosterValidationService;
  const record = vi.fn().mockResolvedValue(snapshot());
  const snapshots = {
    record,
  } as unknown as RosterSnapshotRecorderService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new TransitionRosterUseCase(
      UOW,
      CLOCK,
      lookup,
      rosters,
      entries,
      source,
      validation,
      snapshots,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    events,
    record,
    audit,
  };
}

describe('TransitionRosterUseCase', () => {
  it('publishes a draft, snapshots it, and enqueues the notify signal', async () => {
    const { useCase, events, record, audit } = build({});
    const published = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      transition: RosterTransition.Publish,
      expectedRecordVersion: 1,
    });
    expect(published.status).toBe(RosterStatus.Published);
    expect(record.mock.calls[0]?.[2]).toBe(SnapshotReason.Published);
    expect(audit.record.mock.calls[0]?.[1].action).toBe('roster.transitioned');
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'roster.published.v1',
      payload: {
        snapshotId: 'snap-1',
        audience: RosterAudience.SelectedAndNotSelected,
        selectedCount: 14,
        notSelectedCount: 6,
      },
    });
  });

  it('tells only the named players when a match roster publishes', async () => {
    const { useCase, events } = build({
      existing: roster({ rosterKind: RosterKind.Match, fixtureId: 'fix-1' }),
      changed: roster({
        rosterKind: RosterKind.Match,
        fixtureId: 'fix-1',
        status: RosterStatus.Published,
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      transition: RosterTransition.Publish,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue.mock.calls[0]?.[1].payload.audience).toBe(
      RosterAudience.SelectedOnly,
    );
  });

  it('archives without snapshotting or notifying', async () => {
    const { useCase, events, record } = build({
      changed: roster({ status: RosterStatus.Archived }),
    });
    const archived = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      transition: RosterTransition.Archive,
      expectedRecordVersion: 1,
    });
    expect(archived.status).toBe(RosterStatus.Archived);
    expect(record).not.toHaveBeenCalled();
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an unreachable transition before touching anything', async () => {
    const { useCase, record } = build({
      existing: roster({ status: RosterStatus.Archived }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        transition: RosterTransition.Publish,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(RosterInvalidTransitionError);
    expect(record).not.toHaveBeenCalled();
  });

  it('re-enforces the composition rules the coach previewed', async () => {
    const { useCase, record } = build({ publishable: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        transition: RosterTransition.Publish,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(RosterConstraintError);
    expect(record).not.toHaveBeenCalled();
  });

  it('raises a version conflict when the guarded write matches no row', async () => {
    const { useCase, events } = build({ changed: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        transition: RosterTransition.Publish,
        expectedRecordVersion: 9,
      }),
    ).rejects.toBeInstanceOf(RosterVersionConflictError);
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('notifies nobody when the published roster names nobody', async () => {
    const { useCase, events } = build({ selected: 0 });
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      transition: RosterTransition.Publish,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue.mock.calls[0]?.[1].payload.audience).toBe(
      RosterAudience.None,
    );
  });
});
