import { describe, expect, it, vi } from 'vitest';

import { RsvpClosedError } from '../errors/rsvp-closed.error';
import { RsvpDeadlinePassedError } from '../errors/rsvp-deadline-passed.error';
import { RsvpNotMemberError } from '../errors/rsvp-not-member.error';
import { SessionStatus, SessionVisibility } from '../model/practices.enums';
import type { PracticeSession } from '../model/practices.types';
import { RsvpSource, RsvpStatus } from '../model/rsvp.enums';
import type { PracticeRsvp, SetRsvpCommand } from '../model/rsvp.types';
import { SetOwnRsvpUseCase } from './set-own-rsvp.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const SCOPE = {} as never;
const ACTOR = { userId: 'user-1', email: 'm@example.test', roles: [] };
const COMMAND: SetRsvpCommand = {
  status: RsvpStatus.Going,
  reasonCategory: null,
  note: null,
  noteVisibility: null,
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
    ...overrides,
  };
}

function recordedRsvp(): PracticeRsvp {
  return {
    id: 'rsvp-1',
    sessionId: 'ses-1',
    teamId: 'team-1',
    seasonId: null,
    membershipId: 'mem-1',
    userId: 'user-1',
    status: RsvpStatus.Going,
    reasonCategory: null,
    note: null,
    noteVisibility: null as never,
    source: RsvpSource.Self,
    waitlisted: false,
    respondedAt: NOW,
    createdBy: 'user-1',
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
    findActiveByUser: vi
      .fn()
      .mockResolvedValue({ id: 'mem-1', userId: 'user-1' }),
  };
  const recorder = {
    record: vi
      .fn()
      .mockResolvedValue({ rsvp: recordedRsvp(), promotedMembershipId: null }),
  };
  const useCase = new SetOwnRsvpUseCase(
    unitOfWork as never,
    clock,
    lookup as never,
    memberships as never,
    recorder as never,
  );
  return { useCase, memberships, recorder };
}

describe('SetOwnRsvpUseCase', () => {
  it('records a member self response and returns the view', async () => {
    const harness = build(session());
    const view = await harness.useCase.execute(
      ACTOR,
      'team-1',
      'ses-1',
      COMMAND,
    );
    expect(view.status).toBe(RsvpStatus.Going);
    expect(harness.recorder.record.mock.calls[0]?.[1]).toMatchObject({
      source: RsvpSource.Self,
      isOverride: false,
      membershipId: 'mem-1',
    });
  });

  it('rejects a session that does not accept RSVP', async () => {
    const harness = build(session({ status: SessionStatus.Draft }));
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND),
    ).rejects.toBeInstanceOf(RsvpClosedError);
    expect(harness.recorder.record).not.toHaveBeenCalled();
  });

  it('rejects a response after the RSVP deadline', async () => {
    const harness = build(
      session({ rsvpCutoffAt: new Date('2026-06-01T11:00:00.000Z') }),
    );
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND),
    ).rejects.toBeInstanceOf(RsvpDeadlinePassedError);
  });

  it('forbids a caller without an active membership in the team', async () => {
    const harness = build(session());
    harness.memberships.findActiveByUser.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'ses-1', COMMAND),
    ).rejects.toBeInstanceOf(RsvpNotMemberError);
  });
});
