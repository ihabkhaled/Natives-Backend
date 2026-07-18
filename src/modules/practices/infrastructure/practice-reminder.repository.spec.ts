import { describe, expect, it, vi } from 'vitest';

import { PracticeReminderRepository } from './practice-reminder.repository';

describe('PracticeReminderRepository', () => {
  it('returns bounded active member candidates without private RSVP fields', async () => {
    const scope = {
      run: vi.fn().mockResolvedValue([
        {
          session_id: 'session-1',
          session_version: 3,
          team_id: 'team-1',
          season_id: null,
          user_id: 'user-2',
          starts_at: '2026-07-19T12:00:00.000Z',
          rsvp_cutoff_at: '2026-07-19T10:00:00.000Z',
          has_responded: false,
        },
      ]),
    };
    const repository = new PracticeReminderRepository();
    const page = await repository.listCandidates(
      scope as never,
      'team-1',
      'session-1',
      null,
    );
    expect(page[0]).toMatchObject({
      userId: 'user-2',
      hasResponded: false,
      sessionVersion: 3,
    });
    expect(scope.run.mock.calls[0]?.[0]).toContain(
      'ORDER BY "memberships"."user_id" ASC',
    );
    expect(scope.run.mock.calls[0]?.[0]).not.toContain(
      '"practice_rsvps"."note"',
    );
    expect(scope.run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'session-1',
      null,
      100,
    ]);
  });
});
