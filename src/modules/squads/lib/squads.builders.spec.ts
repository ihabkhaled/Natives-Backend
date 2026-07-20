import { describe, expect, it } from 'vitest';

import {
  AvailabilitySource,
  AvailabilityStatus,
  SelectionEventType,
  SelectionRole,
  SquadStatus,
} from '../model/squads.enums';
import type { Availability, Squad } from '../model/squads.types';
import {
  buildAvailabilityAudit,
  buildAvailabilityUpsert,
  buildNewSquad,
  buildSelectionAudit,
  buildSelectionEvent,
  buildSelectionRemoval,
  buildSelectionWrite,
  buildSquadAudit,
  buildSquadCreatedEvent,
  buildSquadLockedEvent,
  buildSquadPublishedEvent,
  buildSquadStatusChange,
} from './squads.builders';

const NOW = new Date('2026-02-01T12:00:00.000Z');
const LATER = new Date('2026-03-01T12:00:00.000Z');

function squad(overrides: Partial<Squad> = {}): Squad {
  return {
    squadId: 'squad-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    name: 'Nationals Squad',
    status: SquadStatus.Draft,
    attendanceThresholdPct: 70,
    policyVersion: 'eligibility-signals-v1',
    selectionDeadline: null,
    notes: null,
    revision: 1,
    recordVersion: 2,
    createdBy: 'user-1',
    publishedBy: null,
    publishedAt: null,
    lockedAt: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('squads.builders row builders', () => {
  it('builds a new squad row', () => {
    const created = buildNewSquad(
      'squad-1',
      'team-1',
      {
        name: 'Nationals Squad',
        seasonId: 'season-1',
        competitionId: null,
        attendanceThresholdPct: 70,
        selectionDeadline: null,
        notes: null,
      },
      'eligibility-signals-v1',
      'user-1',
      NOW,
    );
    expect(created.id).toBe('squad-1');
    expect(created.createdBy).toBe('user-1');
    expect(created.policyVersion).toBe('eligibility-signals-v1');
  });

  it('stamps a publication instant and actor when publishing', () => {
    const change = buildSquadStatusChange(
      squad(),
      'team-1',
      SquadStatus.Published,
      'user-2',
      false,
      2,
      LATER,
    );
    expect(change.toStatus).toBe(SquadStatus.Published);
    expect(change.publishedBy).toBe('user-2');
    expect(change.publishedAt).toBe(LATER);
    expect(change.lockedAt).toBeNull();
    expect(change.bumpRevision).toBe(false);
  });

  it('stamps a lock instant while keeping the prior publication trail', () => {
    const change = buildSquadStatusChange(
      squad({
        status: SquadStatus.Published,
        publishedBy: 'user-2',
        publishedAt: NOW,
      }),
      'team-1',
      SquadStatus.Locked,
      'user-3',
      false,
      2,
      LATER,
    );
    expect(change.lockedAt).toBe(LATER);
    expect(change.publishedBy).toBe('user-2');
    expect(change.publishedAt).toBe(NOW);
  });

  it('bumps the revision and stamps archival when requested', () => {
    const revise = buildSquadStatusChange(
      squad({ status: SquadStatus.Locked }),
      'team-1',
      SquadStatus.Draft,
      'user-2',
      true,
      2,
      LATER,
    );
    expect(revise.bumpRevision).toBe(true);
    const archive = buildSquadStatusChange(
      squad(),
      'team-1',
      SquadStatus.Archived,
      'user-2',
      false,
      2,
      LATER,
    );
    expect(archive.archivedAt).toBe(LATER);
  });

  it('builds a selection write without an override', () => {
    const write = buildSelectionWrite(
      'sel-1',
      'squad-1',
      'team-1',
      'm-1',
      SelectionRole.Player,
      'starter',
      null,
      'passed',
      'user-2',
      NOW,
    );
    expect(write.eligibilityOverridden).toBe(false);
    expect(write.overrideReason).toBeNull();
    expect(write.overriddenBy).toBeNull();
    expect(write.selectedBy).toBe('user-2');
  });

  it('builds a selection write with an override recording actor + reason', () => {
    const write = buildSelectionWrite(
      'sel-1',
      'squad-1',
      'team-1',
      'm-1',
      SelectionRole.Captain,
      'captain',
      { overrideReason: 'coach cleared suspension' },
      'overridden:active_status',
      'user-2',
      NOW,
    );
    expect(write.eligibilityOverridden).toBe(true);
    expect(write.overrideReason).toBe('coach cleared suspension');
    expect(write.overriddenBy).toBe('user-2');
  });

  it('builds a selection removal and a selection event', () => {
    const removal = buildSelectionRemoval(
      'squad-1',
      'm-1',
      'user-2',
      'cut',
      NOW,
    );
    expect(removal.removedBy).toBe('user-2');
    const event = buildSelectionEvent(
      'ev-1',
      'squad-1',
      'm-1',
      SelectionEventType.Overridden,
      SelectionRole.Player,
      'reason',
      'overridden:attendance',
      'user-2',
      NOW,
    );
    expect(event.eventType).toBe(SelectionEventType.Overridden);
    expect(event.eligibilitySnapshot).toBe('overridden:attendance');
  });

  it('builds an availability upsert', () => {
    const upsert = buildAvailabilityUpsert(
      'av-1',
      'squad-1',
      'team-1',
      'm-1',
      AvailabilityStatus.Unavailable,
      'travel',
      AvailabilitySource.Self,
      'user-1',
      NOW,
    );
    expect(upsert.availability).toBe(AvailabilityStatus.Unavailable);
    expect(upsert.declaredBy).toBe('user-1');
  });
});

describe('squads.builders audit + events', () => {
  it('builds a squad audit entry', () => {
    const audit = buildSquadAudit('squad.created', 'user-1', squad());
    expect(audit.resourceId).toBe('squad-1');
    expect(audit.seasonId).toBe('season-1');
    expect(audit.diff['status']).toBe(SquadStatus.Draft);
  });

  it('builds a selection audit entry carrying override evidence', () => {
    const audit = buildSelectionAudit(
      'squad.selection.overridden',
      'user-2',
      squad(),
      'm-1',
      'overridden:attendance',
      true,
    );
    expect(audit.resourceId).toBe('m-1');
    expect(audit.diff['overridden']).toBe(true);
    expect(audit.diff['eligibilitySnapshot']).toBe('overridden:attendance');
  });

  it('builds an availability audit entry', () => {
    const availability: Availability = {
      availabilityId: 'av-1',
      squadId: 'squad-1',
      teamId: 'team-1',
      membershipId: 'm-1',
      availability: AvailabilityStatus.Available,
      reason: null,
      source: AvailabilitySource.Self,
      declaredBy: 'user-1',
      recordVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const audit = buildAvailabilityAudit('user-1', availability, 'season-1');
    expect(audit.resourceId).toBe('m-1');
    expect(audit.diff['availability']).toBe(AvailabilityStatus.Available);
  });

  it('builds versioned, privacy-safe squad events', () => {
    const created = buildSquadCreatedEvent(squad(), 'user-1');
    expect(created.eventType).toBe('squad.created.v1');
    expect(created.payload['selectionCount']).toBe(0);
    const published = buildSquadPublishedEvent(squad(), 'user-2', 12);
    expect(published.eventType).toBe('squad.published.v1');
    expect(published.payload['selectionCount']).toBe(12);
    expect(published.payload['competitionId']).toBe('comp-1');
    const locked = buildSquadLockedEvent(squad(), 'user-2', 12);
    expect(locked.eventType).toBe('squad.locked.v1');
  });
});
