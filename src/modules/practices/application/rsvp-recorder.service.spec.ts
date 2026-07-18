import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import {
  RsvpNoteVisibility,
  RsvpSource,
  RsvpStatus,
} from '../model/rsvp.enums';
import type { PracticeRsvp, RsvpWriteContext } from '../model/rsvp.types';
import { RsvpRecorderService } from './rsvp-recorder.service';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;

function session(capacity: number | null): PracticeSession {
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
    capacity,
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
    note: null,
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

function context(
  capacity: number | null,
  overrides: Partial<RsvpWriteContext> = {},
): RsvpWriteContext {
  return {
    session: session(capacity),
    membershipId: 'mem-1',
    userId: 'user-1',
    status: RsvpStatus.Going,
    reasonCategory: null,
    note: null,
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

function build() {
  const rsvps = {
    findBySessionMembership: vi.fn().mockResolvedValue(null),
    insert: vi.fn(),
    update: vi.fn(),
    promote: vi.fn(),
    countConfirmedGoing: vi.fn().mockResolvedValue(0),
    findEarliestWaitlisted: vi.fn().mockResolvedValue(null),
  };
  const revisions = { append: vi.fn().mockResolvedValue(undefined) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const events = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const idGenerator = { generate: vi.fn().mockReturnValue('gen') };
  const service = new RsvpRecorderService(
    idGenerator,
    rsvps as never,
    revisions as never,
    audit as never,
    events as never,
  );
  return { service, rsvps, revisions, audit, events };
}

describe('RsvpRecorderService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('inserts a first response, records the side effects, no promotion', async () => {
    harness.rsvps.insert.mockResolvedValue(rsvp());
    const outcome = await harness.service.record(SCOPE, context(null));
    expect(outcome.rsvp.status).toBe(RsvpStatus.Going);
    expect(outcome.promotedMembershipId).toBeNull();
    expect(harness.rsvps.countConfirmedGoing).not.toHaveBeenCalled();
    expect(harness.revisions.append).toHaveBeenCalledOnce();
    expect(harness.audit.record).toHaveBeenCalledOnce();
    expect(harness.events.enqueue).toHaveBeenCalledOnce();
  });

  it('confirms a going answer when a capped session has a free spot', async () => {
    harness.rsvps.countConfirmedGoing.mockResolvedValue(4);
    harness.rsvps.insert.mockResolvedValue(rsvp({ waitlisted: false }));
    await harness.service.record(SCOPE, context(10));
    expect(harness.rsvps.insert.mock.calls[0]?.[1]).toMatchObject({
      waitlisted: false,
    });
  });

  it('waitlists a going answer when the capped session is full', async () => {
    harness.rsvps.countConfirmedGoing.mockResolvedValue(10);
    harness.rsvps.insert.mockResolvedValue(rsvp({ waitlisted: true }));
    await harness.service.record(SCOPE, context(10));
    expect(harness.rsvps.insert.mock.calls[0]?.[1]).toMatchObject({
      waitlisted: true,
    });
  });

  it('does not count confirmed for a non-going answer on a capped session', async () => {
    harness.rsvps.insert.mockResolvedValue(
      rsvp({ status: RsvpStatus.NotGoing }),
    );
    await harness.service.record(
      SCOPE,
      context(10, { status: RsvpStatus.NotGoing }),
    );
    expect(harness.rsvps.countConfirmedGoing).not.toHaveBeenCalled();
  });

  it('maps a concurrent duplicate insert to a version conflict', async () => {
    harness.rsvps.insert.mockResolvedValue(null);
    await expect(
      harness.service.record(SCOPE, context(null)),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('updates an existing response when the expected version matches', async () => {
    harness.rsvps.findBySessionMembership.mockResolvedValue(
      rsvp({ version: 2 }),
    );
    harness.rsvps.update.mockResolvedValue(rsvp({ version: 3 }));
    const outcome = await harness.service.record(
      SCOPE,
      context(null, { expectedVersion: 2 }),
    );
    expect(outcome.rsvp.version).toBe(3);
    expect(harness.rsvps.update).toHaveBeenCalledOnce();
  });

  it('rejects a stale expected version before writing', async () => {
    harness.rsvps.findBySessionMembership.mockResolvedValue(
      rsvp({ version: 5 }),
    );
    await expect(
      harness.service.record(SCOPE, context(null, { expectedVersion: 2 })),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
    expect(harness.rsvps.update).not.toHaveBeenCalled();
  });

  it('updates without an expected version and maps a lost race to a conflict', async () => {
    harness.rsvps.findBySessionMembership.mockResolvedValue(rsvp());
    harness.rsvps.update.mockResolvedValue(null);
    await expect(
      harness.service.record(SCOPE, context(null)),
    ).rejects.toBeInstanceOf(OptimisticConflictError);
  });

  it('promotes the earliest waitlisted member when a confirmed spot is freed', async () => {
    harness.rsvps.findBySessionMembership.mockResolvedValue(
      rsvp({ status: RsvpStatus.Going, waitlisted: false, version: 1 }),
    );
    harness.rsvps.update.mockResolvedValue(
      rsvp({ status: RsvpStatus.NotGoing, waitlisted: false, version: 2 }),
    );
    const waiter = rsvp({
      id: 'rsvp-2',
      membershipId: 'mem-2',
      userId: 'user-2',
      waitlisted: true,
      version: 1,
    });
    harness.rsvps.findEarliestWaitlisted.mockResolvedValue(waiter);
    harness.rsvps.promote.mockResolvedValue(
      rsvp({ id: 'rsvp-2', membershipId: 'mem-2', waitlisted: false }),
    );

    const outcome = await harness.service.record(
      SCOPE,
      context(10, { status: RsvpStatus.NotGoing }),
    );
    expect(outcome.promotedMembershipId).toBe('mem-2');
    expect(harness.rsvps.promote.mock.calls[0]?.[1]).toMatchObject({
      id: 'rsvp-2',
      expectedVersion: 1,
    });
    expect(harness.revisions.append).toHaveBeenCalledTimes(2);
    expect(harness.events.enqueue).toHaveBeenCalledTimes(2);
  });

  it('promotes no one when the waitlist is empty', async () => {
    harness.rsvps.findBySessionMembership.mockResolvedValue(
      rsvp({ status: RsvpStatus.Going, waitlisted: false }),
    );
    harness.rsvps.update.mockResolvedValue(
      rsvp({ status: RsvpStatus.Maybe, waitlisted: false, version: 2 }),
    );
    const outcome = await harness.service.record(
      SCOPE,
      context(10, { status: RsvpStatus.Maybe }),
    );
    expect(outcome.promotedMembershipId).toBeNull();
    expect(harness.rsvps.promote).not.toHaveBeenCalled();
  });

  it('promotes no one when the promotion write loses a race', async () => {
    harness.rsvps.findBySessionMembership.mockResolvedValue(
      rsvp({ status: RsvpStatus.Going, waitlisted: false }),
    );
    harness.rsvps.update.mockResolvedValue(
      rsvp({ status: RsvpStatus.NotGoing, waitlisted: false, version: 2 }),
    );
    harness.rsvps.findEarliestWaitlisted.mockResolvedValue(
      rsvp({ id: 'rsvp-2', waitlisted: true }),
    );
    harness.rsvps.promote.mockResolvedValue(null);
    const outcome = await harness.service.record(
      SCOPE,
      context(10, { status: RsvpStatus.NotGoing }),
    );
    expect(outcome.promotedMembershipId).toBeNull();
    expect(harness.revisions.append).toHaveBeenCalledOnce();
  });
});
