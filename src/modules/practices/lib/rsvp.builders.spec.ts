import { describe, expect, it } from 'vitest';

import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  RSVP_OVERRIDDEN_ACTION,
  RSVP_PROMOTED_EVENT,
  RSVP_RECIPIENT_KEY,
  RSVP_RECORDED_ACTION,
  RSVP_RECORDED_EVENT,
} from '../model/rsvp.constants';
import {
  RsvpNoteVisibility,
  RsvpSource,
  RsvpStatus,
} from '../model/rsvp.enums';
import type { PracticeRsvp, RsvpWriteContext } from '../model/rsvp.types';
import {
  buildNewRsvp,
  buildPromotionAudit,
  buildPromotionEvent,
  buildPromotionRevision,
  buildRsvpAudit,
  buildRsvpEvent,
  buildRsvpRevision,
  buildRsvpUpdate,
} from './rsvp.builders';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function session(): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: null,
    capacity: 10,
    meetAt: null,
    startsAt: NOW,
    endsAt: NOW,
    rsvpCutoffAt: null,
    visibility: SessionVisibility.Team,
    organizerUserId: null,
    notes: null,
    status: SessionStatus.Published,
    cancellationReason: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function context(overrides: Partial<RsvpWriteContext> = {}): RsvpWriteContext {
  return {
    session: session(),
    membershipId: 'mem-1',
    userId: 'user-1',
    status: RsvpStatus.Going,
    reasonCategory: null,
    note: 'on my way',
    noteVisibility: RsvpNoteVisibility.Coaches,
    source: RsvpSource.Self,
    isOverride: false,
    overrideReason: null,
    expectedVersion: null,
    actorUserId: 'user-1',
    now: NOW,
    ...overrides,
  };
}

function rsvp(overrides: Partial<PracticeRsvp> = {}): PracticeRsvp {
  return {
    id: 'rsvp-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    membershipId: 'mem-1',
    userId: 'user-1',
    status: RsvpStatus.Going,
    reasonCategory: null,
    note: 'on my way',
    noteVisibility: RsvpNoteVisibility.Coaches,
    source: RsvpSource.Self,
    waitlisted: false,
    respondedAt: NOW,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

describe('buildNewRsvp / buildRsvpUpdate', () => {
  it('builds an insert row from the session scope and context', () => {
    const row = buildNewRsvp('rsvp-9', context(), true);
    expect(row).toMatchObject({
      id: 'rsvp-9',
      sessionId: 'ses-1',
      teamId: 'team-1',
      seasonId: 'season-1',
      membershipId: 'mem-1',
      waitlisted: true,
      source: RsvpSource.Self,
      respondedAt: NOW,
      createdBy: 'user-1',
    });
  });

  it('builds a version-guarded update carrying the existing version', () => {
    const update = buildRsvpUpdate(rsvp({ version: 4 }), context(), false);
    expect(update).toMatchObject({
      id: 'rsvp-1',
      expectedVersion: 4,
      waitlisted: false,
      respondedAt: NOW,
    });
  });
});

describe('buildRsvpRevision', () => {
  it('records a null from-status for a first response', () => {
    const revision = buildRsvpRevision('rev-1', null, rsvp(), context());
    expect(revision.fromStatus).toBeNull();
    expect(revision.toStatus).toBe(RsvpStatus.Going);
    expect(revision.isOverride).toBe(false);
  });

  it('records the previous status and override reason on a change', () => {
    const revision = buildRsvpRevision(
      'rev-2',
      rsvp({ status: RsvpStatus.Maybe }),
      rsvp({ status: RsvpStatus.NotGoing }),
      context({ isOverride: true, overrideReason: 'injury desk' }),
    );
    expect(revision.fromStatus).toBe(RsvpStatus.Maybe);
    expect(revision.toStatus).toBe(RsvpStatus.NotGoing);
    expect(revision.isOverride).toBe(true);
    expect(revision.overrideReason).toBe('injury desk');
  });
});

describe('buildPromotionRevision', () => {
  it('records a system going->going promotion', () => {
    const revision = buildPromotionRevision(
      'rev-3',
      rsvp({ waitlisted: false }),
      rsvp({ waitlisted: true }),
      NOW,
    );
    expect(revision.source).toBe(RsvpSource.System);
    expect(revision.waitlisted).toBe(false);
    expect(revision.actorUserId).toBeNull();
    expect(revision.isOverride).toBe(false);
  });
});

describe('audit builders', () => {
  it('labels a self response with the recorded action', () => {
    const audit = buildRsvpAudit(context(), rsvp());
    expect(audit.action).toBe(RSVP_RECORDED_ACTION);
    expect(audit.diff).toMatchObject({ isOverride: false, status: 'going' });
    expect(JSON.stringify(audit.diff)).not.toContain('on my way');
  });

  it('labels an override with the overridden action', () => {
    const audit = buildRsvpAudit(context({ isOverride: true }), rsvp());
    expect(audit.action).toBe(RSVP_OVERRIDDEN_ACTION);
    expect(audit.diff).toMatchObject({ isOverride: true });
  });

  it('builds a promotion audit with no actor', () => {
    const audit = buildPromotionAudit(rsvp());
    expect(audit.actorUserId).toBeNull();
    expect(audit.resourceId).toBe('rsvp-1');
  });
});

describe('event builders', () => {
  it('targets the responding member and omits the free-text note', () => {
    const event = buildRsvpEvent(rsvp(), context());
    expect(event.eventType).toBe(RSVP_RECORDED_EVENT);
    expect(event.payload[RSVP_RECIPIENT_KEY]).toBe('user-1');
    expect(JSON.stringify(event.payload)).not.toContain('on my way');
  });

  it('builds a promotion event addressed to the promoted member', () => {
    const event = buildPromotionEvent(rsvp({ userId: 'user-2' }));
    expect(event.eventType).toBe(RSVP_PROMOTED_EVENT);
    expect(event.actorUserId).toBeNull();
    expect(event.payload[RSVP_RECIPIENT_KEY]).toBe('user-2');
  });
});
