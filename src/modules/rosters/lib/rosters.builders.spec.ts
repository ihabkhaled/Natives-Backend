import { AuditOutcome } from '@modules/platform';
import { describe, expect, it } from 'vitest';

import {
  RosterAudience,
  RosterAvailabilitySource,
  RosterAvailabilityStatus,
  RosterDivision,
  RosterEntryRole,
  RosterGenderBucket,
  RosterKind,
  RosterLine,
  RosterMemberStatus,
  RosterPosition,
  RosterStatus,
  SnapshotReason,
} from '../model/rosters.enums';
import type {
  Roster,
  RosterAvailabilityRecord,
  RosterCandidate,
  RosterConstraints,
  RosterEntryContent,
  RosterSnapshot,
  RosterSnapshotEntry,
} from '../model/rosters.types';
import {
  buildAvailabilityAudit,
  buildAvailabilityUpsert,
  buildCarriedEntryWrite,
  buildEntryAudit,
  buildEntryRemoval,
  buildGeneratedEntryWrite,
  buildNewCompetitionRoster,
  buildNewMatchRoster,
  buildRosterAudit,
  buildRosterCreatedEvent,
  buildRosterEntryWrite,
  buildRosterLockedEvent,
  buildRosterPublishedEvent,
  buildRosterRevisedEvent,
  buildRosterStatusChange,
  buildSnapshotAudit,
  buildSuccessorRoster,
} from './rosters.builders';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const EARLIER = new Date('2026-02-01T10:00:00.000Z');

function constraints(): RosterConstraints {
  return {
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: 4,
    requireCaptain: true,
  };
}

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
    currentSnapshotId: null,
    rosterKind: RosterKind.Competition,
    name: 'Nationals Roster',
    status: RosterStatus.Draft,
    division: RosterDivision.Mixed,
    minSize: 7,
    maxSize: 30,
    minWomen: 4,
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
    availability: RosterAvailabilityStatus.Available,
    selectedInSquad: true,
    ...overrides,
  };
}

function entryContent(
  overrides: Partial<RosterEntryContent> = {},
): RosterEntryContent {
  return {
    membershipId: 'member-1',
    jerseyNumber: null,
    entryRole: RosterEntryRole.Player,
    lineAssignment: RosterLine.Any,
    fieldPosition: RosterPosition.Unspecified,
    selectionReason: null,
    ...overrides,
  };
}

function snapshotEntry(): RosterSnapshotEntry {
  return {
    membershipId: 'member-9',
    jerseyNumber: 3,
    entryRole: RosterEntryRole.Captain,
    lineAssignment: RosterLine.Defense,
    fieldPosition: RosterPosition.Cutter,
    genderBucket: RosterGenderBucket.Women,
    availability: RosterAvailabilityStatus.Tentative,
    constraintOverridden: true,
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
    reason: SnapshotReason.Locked,
    rosterStatus: RosterStatus.Locked,
    entryCount: 2,
    checksum: 'abc123',
    entries: [snapshotEntry()],
    takenBy: 'user-1',
    takenAt: NOW,
  };
}

describe('rosters.builders', () => {
  it('builds a first-revision competition roster with no lineage', () => {
    const built = buildNewCompetitionRoster(
      'roster-1',
      'team-1',
      'season-1',
      'comp-1',
      'squad-1',
      'Nationals',
      constraints(),
      '2026-04-01T00:00:00.000Z',
      'notes',
      RosterKind.Competition,
      1,
      'user-1',
      NOW,
    );
    expect(built).toMatchObject({
      fixtureId: null,
      sourceRosterId: null,
      supersedesRosterId: null,
      squadId: 'squad-1',
      revision: 1,
      minWomen: 4,
      policyVersion: 'roster-constraints-v1',
    });
  });

  it('builds a match roster bound to its fixture and optional source', () => {
    const built = buildNewMatchRoster(
      'roster-2',
      'team-1',
      'season-1',
      'comp-1',
      'fixture-1',
      'roster-1',
      'Game 1',
      constraints(),
      null,
      RosterKind.Match,
      1,
      'user-1',
      NOW,
    );
    expect(built).toMatchObject({
      fixtureId: 'fixture-1',
      sourceRosterId: 'roster-1',
      squadId: null,
      selectionDeadline: null,
      rosterKind: RosterKind.Match,
    });
  });

  it('inherits scope, constraints, and lineage into a successor revision', () => {
    const superseded = roster({
      status: RosterStatus.Locked,
      revision: 2,
      selectionDeadline: EARLIER,
      notes: 'travel squad',
    });
    const successor = buildSuccessorRoster(
      'roster-3',
      superseded,
      3,
      'user-2',
      NOW,
    );
    expect(successor).toMatchObject({
      supersedesRosterId: 'roster-1',
      revision: 3,
      teamId: 'team-1',
      seasonId: 'season-1',
      competitionId: 'comp-1',
      minWomen: 4,
      notes: 'travel squad',
      selectionDeadline: EARLIER.toISOString(),
      createdBy: 'user-2',
    });
  });

  it('carries a null deadline forward untouched', () => {
    expect(
      buildSuccessorRoster('roster-3', roster(), 2, 'user-2', NOW)
        .selectionDeadline,
    ).toBeNull();
  });

  it('stamps only the instants each transition target owns', () => {
    const publish = buildRosterStatusChange(
      roster(),
      'team-1',
      RosterStatus.Published,
      'user-2',
      1,
      null,
      NOW,
    );
    expect(publish).toMatchObject({
      publishedBy: 'user-2',
      publishedAt: NOW,
      lockedAt: null,
      revisedAt: null,
      archivedAt: null,
    });
    const lock = buildRosterStatusChange(
      roster({
        status: RosterStatus.Published,
        publishedAt: EARLIER,
        publishedBy: 'user-1',
      }),
      'team-1',
      RosterStatus.Locked,
      'user-3',
      2,
      null,
      NOW,
    );
    expect(lock).toMatchObject({
      publishedBy: 'user-1',
      publishedAt: EARLIER,
      lockedBy: 'user-3',
      lockedAt: NOW,
      revisionReason: null,
    });
  });

  it('stamps the mandatory reason and actor only when superseding', () => {
    const revise = buildRosterStatusChange(
      roster({ status: RosterStatus.Locked, lockedAt: EARLIER }),
      'team-1',
      RosterStatus.Revised,
      'user-4',
      3,
      'injury replacement',
      NOW,
    );
    expect(revise).toMatchObject({
      revisedBy: 'user-4',
      revisedAt: NOW,
      revisionReason: 'injury replacement',
      lockedAt: EARLIER,
    });
    const archive = buildRosterStatusChange(
      roster(),
      'team-1',
      RosterStatus.Archived,
      'user-4',
      1,
      'ignored',
      NOW,
    );
    expect(archive).toMatchObject({
      archivedAt: NOW,
      revisionReason: null,
      revisedAt: null,
    });
  });

  it('prefers an explicit jersey over the profile jersey, and buckets the gender', () => {
    const write = buildRosterEntryWrite(
      'entry-1',
      'roster-1',
      'team-1',
      entryContent({ jerseyNumber: 22 }),
      candidate(),
      null,
      false,
      'user-1',
      NOW,
    );
    expect(write).toMatchObject({
      jerseyNumber: 22,
      genderBucket: RosterGenderBucket.Women,
      availability: RosterAvailabilityStatus.Available,
      constraintOverridden: false,
      overrideReason: null,
      overriddenBy: null,
      selectedBy: 'user-1',
    });
  });

  it('falls back to the profile jersey when none is supplied', () => {
    expect(
      buildRosterEntryWrite(
        'entry-1',
        'roster-1',
        'team-1',
        entryContent(),
        candidate(),
        null,
        false,
        'user-1',
        NOW,
      ).jerseyNumber,
    ).toBe(11);
  });

  it('records override evidence only when the override was exercised', () => {
    const exercised = buildRosterEntryWrite(
      'entry-1',
      'roster-1',
      'team-1',
      entryContent(),
      candidate({ memberStatus: RosterMemberStatus.Suspended }),
      { overrideReason: 'discipline closed' },
      true,
      'user-7',
      NOW,
    );
    expect(exercised).toMatchObject({
      constraintOverridden: true,
      overrideReason: 'discipline closed',
      overriddenBy: 'user-7',
    });
    const unnecessary = buildRosterEntryWrite(
      'entry-2',
      'roster-1',
      'team-1',
      entryContent(),
      candidate(),
      { overrideReason: 'not needed' },
      false,
      'user-7',
      NOW,
    );
    expect(unnecessary).toMatchObject({
      constraintOverridden: false,
      overrideReason: null,
      overriddenBy: null,
    });
  });

  it('builds a generated entry as an unassigned player', () => {
    expect(
      buildGeneratedEntryWrite(
        'entry-1',
        'roster-1',
        'team-1',
        candidate({ gender: null, jerseyNumber: null }),
        'user-1',
        NOW,
      ),
    ).toMatchObject({
      entryRole: RosterEntryRole.Player,
      lineAssignment: RosterLine.Any,
      fieldPosition: RosterPosition.Unspecified,
      genderBucket: RosterGenderBucket.Unknown,
      jerseyNumber: null,
      constraintOverridden: false,
    });
  });

  it('copies a frozen snapshot entry verbatim into a successor revision', () => {
    expect(
      buildCarriedEntryWrite(
        'entry-1',
        'roster-3',
        'team-1',
        snapshotEntry(),
        'user-1',
        NOW,
      ),
    ).toMatchObject({
      membershipId: 'member-9',
      jerseyNumber: 3,
      entryRole: RosterEntryRole.Captain,
      lineAssignment: RosterLine.Defense,
      fieldPosition: RosterPosition.Cutter,
      genderBucket: RosterGenderBucket.Women,
      availability: RosterAvailabilityStatus.Tentative,
      constraintOverridden: true,
      overrideReason: null,
    });
  });

  it('builds a soft removal and an availability upsert', () => {
    expect(
      buildEntryRemoval('roster-1', 'member-1', 'user-1', 'travelling', NOW),
    ).toEqual({
      rosterId: 'roster-1',
      membershipId: 'member-1',
      removedBy: 'user-1',
      reason: 'travelling',
      now: NOW,
    });
    expect(
      buildAvailabilityUpsert(
        'av-1',
        'roster-1',
        'team-1',
        'member-1',
        RosterAvailabilityStatus.Unavailable,
        null,
        RosterAvailabilitySource.Self,
        'user-1',
        NOW,
      ),
    ).toMatchObject({
      availability: RosterAvailabilityStatus.Unavailable,
      source: RosterAvailabilitySource.Self,
      declaredBy: 'user-1',
      reason: null,
    });
  });

  it('audits a roster, an entry, an availability, and a snapshot safely', () => {
    expect(
      buildRosterAudit('roster.created', 'user-1', roster()),
    ).toMatchObject({
      action: 'roster.created',
      resourceType: 'roster',
      resourceId: 'roster-1',
      outcome: AuditOutcome.Success,
      diff: {
        rosterKind: RosterKind.Competition,
        status: RosterStatus.Draft,
        revision: 1,
        recordVersion: 1,
      },
    });
    expect(
      buildEntryAudit(
        'roster.entry.overridden',
        'user-1',
        roster(),
        'member-1',
        'membership_suspended',
        true,
      ).diff,
    ).toEqual({
      rosterId: 'roster-1',
      flags: 'membership_suspended',
      overridden: true,
    });
    const record: RosterAvailabilityRecord = {
      availabilityId: 'av-1',
      rosterId: 'roster-1',
      teamId: 'team-1',
      membershipId: 'member-1',
      availability: RosterAvailabilityStatus.Available,
      reason: null,
      source: RosterAvailabilitySource.Self,
      declaredBy: 'user-1',
      recordVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(buildAvailabilityAudit('user-1', record, 'season-1')).toMatchObject({
      action: 'roster.availability.declared',
      seasonId: 'season-1',
      diff: {
        rosterId: 'roster-1',
        availability: RosterAvailabilityStatus.Available,
        source: RosterAvailabilitySource.Self,
      },
    });
    expect(buildSnapshotAudit('user-1', snapshot()).diff).toEqual({
      rosterId: 'roster-1',
      revision: 1,
      reason: SnapshotReason.Locked,
      entryCount: 2,
      checksum: 'abc123',
    });
  });

  it('builds the created, published, locked, and revised events', () => {
    expect(buildRosterCreatedEvent(roster(), 'user-1', 12)).toMatchObject({
      eventType: 'roster.created.v1',
      eventVersion: 1,
      aggregateType: 'roster',
      aggregateId: 'roster-1',
      payload: {
        rosterKind: RosterKind.Competition,
        competitionId: 'comp-1',
        fixtureId: null,
        revision: 1,
        entryCount: 12,
      },
    });
    expect(
      buildRosterPublishedEvent(
        roster({ status: RosterStatus.Published }),
        'user-1',
        {
          audience: RosterAudience.SelectedAndNotSelected,
          selectedCount: 14,
          notSelectedCount: 6,
        },
        'snap-1',
      ).payload,
    ).toMatchObject({
      snapshotId: 'snap-1',
      audience: RosterAudience.SelectedAndNotSelected,
      selectedCount: 14,
      notSelectedCount: 6,
    });
    expect(
      buildRosterLockedEvent(roster(), 'user-1', 'snap-2', 14),
    ).toMatchObject({
      eventType: 'roster.locked.v1',
      payload: { snapshotId: 'snap-2', entryCount: 14 },
    });
    expect(
      buildRosterRevisedEvent(
        roster({ revision: 2 }),
        'roster-3',
        'user-1',
        'snap-3',
      ),
    ).toMatchObject({
      eventType: 'roster.revised.v1',
      payload: {
        snapshotId: 'snap-3',
        successorRosterId: 'roster-3',
        supersededRevision: 2,
      },
    });
  });
});
