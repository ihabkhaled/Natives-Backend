import { describe, expect, it, vi } from 'vitest';

import { RsvpClosedError } from '../errors/rsvp-closed.error';
import { RsvpMembershipNotFoundError } from '../errors/rsvp-membership-not-found.error';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { RsvpSource, RsvpStatus } from '../model/rsvp.enums';
import type { OverrideRsvpCommand, PracticeRsvp } from '../model/rsvp.types';
import { OverrideRsvpUseCase } from './override-rsvp.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'coach-1', email: 'c@example.test', roles: [] };
const COMMAND: OverrideRsvpCommand = {
  status: RsvpStatus.NotGoing,
  reasonCategory: null,
  note: null,
  noteVisibility: null,
  overrideReason: 'travelling with the national team',
  expectedVersion: null,
};

function session(overrides: Partial<PracticeSession> = {}): PracticeSession {
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
    capacity: null,
    meetAt: null,
    startsAt: NOW,
    endsAt: NOW,
    // A cutoff already in the past: the override must still succeed.
    rsvpCutoffAt: new Date('2026-06-01T11:00:00.000Z'),
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
    ...overrides,
  };
}

function recordedRsvp(): PracticeRsvp {
  return {
    id: 'rsvp-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-9',
    userId: 'user-9',
    status: RsvpStatus.NotGoing,
    reasonCategory: null,
    note: null,
    noteVisibility: null as never,
    source: RsvpSource.Coach,
    waitlisted: false,
    respondedAt: NOW,
    createdBy: 'coach-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function build(existing: PracticeSession) {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const lookup = { requireSession: vi.fn().mockResolvedValue(existing) };
  const memberships = {
    findActiveById: vi
      .fn()
      .mockResolvedValue({ id: 'mem-9', userId: 'user-9' }),
  };
  const recorder = {
    record: vi
      .fn()
      .mockResolvedValue({ rsvp: recordedRsvp(), promotedMembershipId: null }),
  };
  const useCase = new OverrideRsvpUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    memberships as never,
    recorder as never,
  );
  return { useCase, memberships, recorder };
}

describe('OverrideRsvpUseCase', () => {
  it('records a coach override past the deadline and returns the view', async () => {
    const harness = build(session());
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      'mem-9',
      COMMAND,
    );
    expect(view.status).toBe(RsvpStatus.NotGoing);
    expect(harness.recorder.record.mock.calls[0]?.[1]).toMatchObject({
      source: RsvpSource.Coach,
      isOverride: true,
      overrideReason: 'travelling with the national team',
      membershipId: 'mem-9',
    });
  });

  it('rejects an override on a session that does not accept RSVP', async () => {
    const harness = build(session({ status: SessionStatus.Cancelled }));
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', 'mem-9', COMMAND),
    ).rejects.toBeInstanceOf(RsvpClosedError);
    expect(harness.recorder.record).not.toHaveBeenCalled();
  });

  it('returns not-found for a membership outside the team scope', async () => {
    const harness = build(session());
    harness.memberships.findActiveById.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', 'mem-9', COMMAND),
    ).rejects.toBeInstanceOf(RsvpMembershipNotFoundError);
  });
});
