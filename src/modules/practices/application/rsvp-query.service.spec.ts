import { describe, expect, it, vi } from 'vitest';

import { RsvpNotMemberError } from '../errors/rsvp-not-member.error';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  RsvpNoteVisibility,
  RsvpSource,
  RsvpStatus,
} from '../model/rsvp.enums';
import type { PracticeRsvp } from '../model/rsvp.types';
import { RsvpQueryService } from './rsvp-query.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };

function session(): PracticeSession {
  return {
    id: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    scheduleId: null,
    occurrenceDate: null,
    sessionType: 'practice',
    timezone: 'Africa/Cairo',
    venueId: null,
    field: null,
    capacity: 12,
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

function rsvp(): PracticeRsvp {
  return {
    id: 'rsvp-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    userId: 'user-1',
    status: RsvpStatus.Maybe,
    reasonCategory: null,
    note: null,
    noteVisibility: RsvpNoteVisibility.Coaches,
    source: RsvpSource.Self,
    waitlisted: false,
    respondedAt: NOW,
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 2,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const lookup = { requireSession: vi.fn().mockResolvedValue(session()) };
  const memberships = {
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const rsvps = {
    findBySessionMembership: vi.fn().mockResolvedValue(null),
    listParticipants: vi
      .fn()
      .mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    summary: vi.fn().mockResolvedValue({
      going: 5,
      waitlisted: 0,
      notGoing: 1,
      maybe: 2,
      noResponse: 0,
    }),
  };
  const revisions = {
    listBySessionMembership: vi.fn().mockResolvedValue([]),
  };
  const service = new RsvpQueryService(
    unitOfWork as never,
    lookup as never,
    memberships as never,
    rsvps as never,
    revisions as never,
  );
  return { service, lookup, memberships, rsvps, revisions };
}

describe('RsvpQueryService', () => {
  it('returns a synthesized no_response view when the member has not answered', async () => {
    const harness = build();
    const view = await harness.service.getOwnRsvp('team-1', 'ses-1', ACTOR);
    expect(view.status).toBe(RsvpStatus.NoResponse);
    expect(view.version).toBeNull();
  });

  it('returns the stored answer when the member has responded', async () => {
    const harness = build();
    harness.rsvps.findBySessionMembership.mockResolvedValue(rsvp());
    const view = await harness.service.getOwnRsvp('team-1', 'ses-1', ACTOR);
    expect(view.status).toBe(RsvpStatus.Maybe);
    expect(view.version).toBe(2);
  });

  it('forbids own-read for a caller with no active membership', async () => {
    const harness = build();
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.service.getOwnRsvp('team-1', 'ses-1', ACTOR),
    ).rejects.toBeInstanceOf(RsvpNotMemberError);
  });

  it('lists participants within the resolved session scope', async () => {
    const harness = build();
    const result = await harness.service.listParticipants('team-1', 'ses-1', {
      status: null,
      limit: 20,
      offset: 0,
    });
    expect(result.total).toBe(0);
    expect(harness.lookup.requireSession).toHaveBeenCalledOnce();
  });

  it('derives the summary from projected counts and session capacity', async () => {
    const harness = build();
    const summary = await harness.service.getSummary('team-1', 'ses-1');
    expect(summary.capacity).toBe(12);
    expect(summary.going).toBe(5);
    expect(summary.spotsRemaining).toBe(7);
  });

  it('reads a member revision history within scope', async () => {
    const harness = build();
    const history = await harness.service.getHistory(
      'team-1',
      'ses-1',
      'mem-1',
    );
    expect(history.items).toEqual([]);
    expect(harness.revisions.listBySessionMembership).toHaveBeenCalledOnce();
  });
});
