import type { ClockPort } from '@core/clock/clock.port';
import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { RosterSnapshotImmutableError } from '../errors/roster-snapshot-immutable.error';
import type { RosterRepository } from '../infrastructure/roster.repository';
import type { RosterEntryRepository } from '../infrastructure/roster-entry.repository';
import type { RosterSnapshotRepository } from '../infrastructure/roster-snapshot.repository';
import {
  RosterDivision,
  RosterEntryRole,
  RosterEntryStatus,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type {
  Roster,
  RosterEntry,
  RosterSnapshot,
} from '../model/rosters.types';
import { RosterSnapshotRecorderService } from './roster-snapshot-recorder.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const IDS = { generate: () => 'snap-1' };

function roster(): Roster {
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
    recordVersion: 2,
    createdBy: 'user-1',
    publishedBy: 'user-1',
    publishedAt: NOW,
    lockedBy: 'user-1',
    lockedAt: NOW,
    revisedBy: null,
    revisedAt: null,
    revisionReason: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function entry(): RosterEntry {
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
    status: RosterEntryStatus.Selected,
    availability: null,
    selectionReason: null,
    constraintOverridden: false,
    overrideReason: null,
    overriddenBy: null,
    selectedBy: 'user-1',
    removedBy: null,
    removedAt: null,
    removalReason: null,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function written(): RosterSnapshot {
  return {
    snapshotId: 'snap-1',
    rosterId: 'roster-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: null,
    rosterKind: RosterKind.Competition,
    revision: 1,
    reason: SnapshotReason.Locked,
    rosterStatus: RosterStatus.Locked,
    entryCount: 1,
    checksum: 'abc',
    entries: [],
    takenBy: 'user-1',
    takenAt: NOW,
  };
}

function build(existing: RosterSnapshot | null): {
  service: RosterSnapshotRecorderService;
  append: ReturnType<typeof vi.fn>;
  attach: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const attach = vi.fn().mockResolvedValue(undefined);
  const rosters = { attachSnapshot: attach } as unknown as RosterRepository;
  const entries = {
    listActive: vi.fn().mockResolvedValue([entry()]),
  } as unknown as RosterEntryRepository;
  const append = vi.fn().mockResolvedValue(written());
  const snapshots = {
    append,
    findByRevisionReason: vi.fn().mockResolvedValue(existing),
  } as unknown as RosterSnapshotRepository;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new RosterSnapshotRecorderService(
      CLOCK,
      IDS,
      rosters,
      entries,
      snapshots,
      audit as unknown as AuditRecorderService,
    ),
    append,
    attach,
    audit,
  };
}

describe('RosterSnapshotRecorderService', () => {
  it('freezes the active entries and attaches the snapshot to the roster', async () => {
    const { service, append, attach, audit } = build(null);
    const snapshot = await service.record(
      TX,
      roster(),
      SnapshotReason.Locked,
      'user-1',
    );
    expect(snapshot.snapshotId).toBe('snap-1');
    expect(append.mock.calls[0]?.[1]).toMatchObject({
      id: 'snap-1',
      rosterId: 'roster-1',
      revision: 1,
      reason: SnapshotReason.Locked,
      entryCount: 1,
      takenBy: 'user-1',
      now: NOW,
    });
    expect(attach).toHaveBeenCalledWith(TX, 'roster-1', 'snap-1', NOW);
    expect(audit.record).toHaveBeenCalledOnce();
  });

  it('refuses to rewrite a snapshot already taken for this revision and reason', async () => {
    const { service, append } = build(written());
    await expect(
      service.record(TX, roster(), SnapshotReason.Locked, 'user-1'),
    ).rejects.toBeInstanceOf(RosterSnapshotImmutableError);
    expect(append).not.toHaveBeenCalled();
  });

  it('stamps the checksum of the frozen selection, not of the live roster', async () => {
    const { service, append } = build(null);
    await service.record(TX, roster(), SnapshotReason.Published, 'user-2');
    const payload = append.mock.calls[0]?.[1] as { checksum: string };
    expect(payload.checksum).toHaveLength(64);
  });
});
