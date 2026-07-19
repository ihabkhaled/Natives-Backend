import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EnqueueDevelopmentRemindersUseCase } from './enqueue-development-reminders.use-case';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const clock = { now: vi.fn(() => NOW) };
  const scope = { validate: vi.fn() };
  const feedback = {
    listReminders: vi.fn(() => [
      {
        id: 'fb-1',
        team_id: 'team-1',
        season_id: null,
        membership_id: 'mem-1',
        reminder_user_id: 'player-1',
        published_at: NOW,
      },
    ]),
  };
  const goals = {
    listOverdue: vi.fn(() => [
      {
        id: 'goal-1',
        team_id: 'team-1',
        season_id: null,
        membership_id: 'mem-1',
        reminder_user_id: 'player-1',
        due_date: '2026-01-01',
      },
      {
        id: 'goal-2',
        team_id: 'team-1',
        season_id: null,
        membership_id: 'mem-2',
        reminder_user_id: 'player-2',
        due_date: '2026-02-01',
      },
    ]),
  };
  const events = { enqueue: vi.fn() };
  const useCase = new EnqueueDevelopmentRemindersUseCase(
    unitOfWork as never,
    clock as never,
    scope as never,
    feedback as never,
    goals as never,
    events as never,
  );
  return { scope, goals, events, useCase };
}

describe('EnqueueDevelopmentRemindersUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('validates scope and queues one privacy-safe event per finding', async () => {
    const result = await harness.useCase.execute('team-1');
    expect(harness.scope.validate).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      null,
    );
    expect(result).toEqual({ feedbackReminders: 1, goalReminders: 2 });
    expect(harness.events.enqueue).toHaveBeenCalledTimes(3);
    expect(harness.goals.listOverdue).toHaveBeenCalledWith(
      expect.anything(),
      'team-1',
      '2026-06-15',
    );
    const serialized = harness.events.enqueue.mock.calls
      .map(call => JSON.stringify(call[1]))
      .join('');
    expect(serialized).not.toContain('coach_note');
  });
});
