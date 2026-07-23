import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeSessionNotFoundError } from '../errors/practice-session-not-found.error';
import { ReminderKind } from '../model/calendar.enums';
import type { ReminderCandidate } from '../model/calendar.types';
import { PracticeReminderAdminService } from './practice-reminder-admin.service';

const SCOPE = {} as never;
const NOW = new Date('2026-07-18T10:00:00.000Z');
const ACTOR = { userId: 'coach-1', email: 'coach@example.test', roles: [] };
const CANDIDATE: ReminderCandidate = {
  sessionId: 'session-1',
  sessionVersion: 4,
  teamId: 'team-1',
  seasonId: null,
  userId: 'member-1',
  startsAt: new Date('2026-07-19T09:00:00.000Z'),
  rsvpCutoffAt: new Date('2026-07-18T11:00:00.000Z'),
  hasResponded: false,
};

function build() {
  const candidates = {
    listCandidates: vi
      .fn()
      .mockResolvedValueOnce([CANDIDATE])
      .mockResolvedValueOnce([]),
  };
  const sessions = {
    findByIdInTeam: vi.fn().mockResolvedValue({ id: 'session-1' }),
  };
  const events = { enqueue: vi.fn().mockResolvedValue({ eventId: 'event-1' }) };
  const quietHours = {
    get: vi.fn().mockResolvedValue({
      urgentCancellationOverride: true,
    }),
    isAllowed: vi.fn().mockResolvedValue(true),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((operation: (scope: never) => unknown) =>
      operation(SCOPE),
    ),
  };
  const service = new PracticeReminderAdminService(
    unitOfWork as never,
    { now: () => NOW, uptime: () => 0 },
    candidates as never,
    sessions as never,
    events as never,
    quietHours as never,
  );
  return { service, candidates, sessions, events, quietHours };
}

describe('PracticeReminderAdminService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('previews eligible recipients and due reminder kinds', async () => {
    await expect(
      harness.service.preview(ACTOR, 'team-1', 'session-1'),
    ).resolves.toMatchObject({
      sessionId: 'session-1',
      totalEligible: 1,
      noResponse: 1,
      upcoming: true,
      cutoff: true,
      urgentCancellationOverride: true,
    });
  });

  it('serves the coach-readable status projection without enqueueing anything', async () => {
    await expect(
      harness.service.status(ACTOR, 'team-1', 'session-1'),
    ).resolves.toMatchObject({
      sessionId: 'session-1',
      totalEligible: 1,
      noResponse: 1,
      upcoming: true,
      cutoff: true,
      kinds: expect.arrayContaining([ReminderKind.Upcoming]),
    });
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues deterministic per-version reminder facts for dedupe', async () => {
    await expect(
      harness.service.dispatch(ACTOR, 'team-1', 'session-1'),
    ).resolves.toEqual({ candidates: 1, enqueued: 3 });
    const inputs = harness.events.enqueue.mock.calls.map(call => call[1]);
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toMatchObject({
      actorUserId: 'coach-1',
      payload: {
        recipientUserId: 'member-1',
        notificationDedupeKey: 'practice.reminder.upcoming:session-1:v4',
      },
    });
  });

  it('previews a test suppressed by quiet hours without enqueueing', async () => {
    harness.quietHours.isAllowed.mockResolvedValue(false);
    await expect(
      harness.service.sendTest(ACTOR, 'team-1', 'session-1'),
    ).resolves.toEqual({ enqueued: false, reason: 'quiet_hours' });
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues a test to the authenticated admin without provider details', async () => {
    await expect(
      harness.service.sendTest(ACTOR, 'team-1', 'session-1'),
    ).resolves.toEqual({ enqueued: true, reason: null });
    expect(harness.events.enqueue.mock.calls[0]?.[1]).toMatchObject({
      actorUserId: 'coach-1',
      payload: { recipientUserId: 'coach-1', test: true },
    });
  });

  it('keeps a cross-team or missing session indistinguishable', async () => {
    harness.sessions.findByIdInTeam.mockResolvedValue(null);
    await expect(
      harness.service.dispatch(ACTOR, 'other-team', 'session-1'),
    ).rejects.toBeInstanceOf(PracticeSessionNotFoundError);
    expect(harness.events.enqueue).not.toHaveBeenCalled();
  });
});
