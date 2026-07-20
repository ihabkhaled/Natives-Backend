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
import {
  RosterDivision,
  RosterKind,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type { Roster, RosterSnapshot } from '../model/rosters.types';
import { LockRosterUseCase } from './lock-roster.use-case';
import type { RosterLookupService } from './roster-lookup.service';
import type { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';
import type { RosterValidationService } from './roster-validation.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
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
    recordVersion: 2,
    createdBy: 'user-1',
    publishedBy: 'user-1',
    publishedAt: NOW,
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
    snapshotId: 'snap-2',
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    rosterKind: RosterKind.Competition,
    revision: 1,
    reason: SnapshotReason.Locked,
    rosterStatus: RosterStatus.Locked,
    entryCount: 14,
    checksum: 'abc',
    entries: [],
    takenBy: 'admin-1',
    takenAt: NOW,
  };
}

function build(options: {
  existing?: Roster;
  changed?: Roster | null;
  publishable?: boolean;
}): {
  useCase: LockRosterUseCase;
  events: { enqueue: ReturnType<typeof vi.fn> };
  record: ReturnType<typeof vi.fn>;
  applyStatusChange: ReturnType<typeof vi.fn>;
} {
  const changed =
    'changed' in options
      ? options.changed
      : roster({
          status: RosterStatus.Locked,
          lockedAt: NOW,
          recordVersion: 3,
        });
  const lookup = {
    // The first read resolves the roster to freeze; the lock re-reads it after
    // the snapshot so the response carries the frozen record's snapshot id.
    require: vi
      .fn()
      .mockResolvedValueOnce(options.existing ?? roster())
      .mockResolvedValue(
        changed === null
          ? roster()
          : { ...changed, currentSnapshotId: 'snap-2' },
      ),
  } as unknown as RosterLookupService;
  const applyStatusChange = vi.fn().mockResolvedValue(changed);
  const rosters = { applyStatusChange } as unknown as RosterRepository;
  const validation = {
    assertPublishable: vi.fn().mockImplementation(() => {
      if (options.publishable === false) {
        throw new RosterConstraintError();
      }
      return Promise.resolve(undefined);
    }),
  } as unknown as RosterValidationService;
  const record = vi.fn().mockResolvedValue(snapshot());
  const snapshots = { record } as unknown as RosterSnapshotRecorderService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new LockRosterUseCase(
      UOW,
      CLOCK,
      lookup,
      rosters,
      validation,
      snapshots,
      audit as unknown as AuditRecorderService,
      events as unknown as RecordDomainEventService,
    ),
    events,
    record,
    applyStatusChange,
  };
}

describe('LockRosterUseCase', () => {
  it('freezes a published roster, snapshots it, and enqueues roster.locked', async () => {
    const { useCase, events, record } = build({});
    const locked = await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      expectedRecordVersion: 2,
    });
    expect(locked.status).toBe(RosterStatus.Locked);
    expect(record.mock.calls[0]?.[2]).toBe(SnapshotReason.Locked);
    expect(events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      eventType: 'roster.locked.v1',
      payload: { snapshotId: 'snap-2', entryCount: 14 },
    });
  });

  it('refuses to lock a roster that was never published', async () => {
    const { useCase, applyStatusChange } = build({
      existing: roster({ status: RosterStatus.Draft }),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(RosterInvalidTransitionError);
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('refuses to freeze a roster that breaks a blocking rule', async () => {
    const { useCase, applyStatusChange } = build({ publishable: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        expectedRecordVersion: 2,
      }),
    ).rejects.toBeInstanceOf(RosterConstraintError);
    expect(applyStatusChange).not.toHaveBeenCalled();
  });

  it('raises a version conflict without snapshotting anything', async () => {
    const { useCase, record, events } = build({ changed: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'roster-1', {
        expectedRecordVersion: 99,
      }),
    ).rejects.toBeInstanceOf(RosterVersionConflictError);
    expect(record).not.toHaveBeenCalled();
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('stamps the lock instant and actor from the frozen record', async () => {
    const { useCase, applyStatusChange } = build({});
    await useCase.execute(ACTOR, 'team-1', 'roster-1', {
      expectedRecordVersion: 2,
    });
    expect(applyStatusChange.mock.calls[0]?.[1]).toMatchObject({
      toStatus: RosterStatus.Locked,
      lockedBy: 'admin-1',
      lockedAt: NOW,
      expectedRecordVersion: 2,
    });
  });
});
