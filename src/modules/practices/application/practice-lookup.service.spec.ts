import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeScheduleNotFoundError } from '../errors/practice-schedule-not-found.error';
import { PracticeSessionNotFoundError } from '../errors/practice-session-not-found.error';
import { PracticeLookupService } from './practice-lookup.service';

const SCOPE = {} as never;

function build() {
  const schedules = { findByIdInTeam: vi.fn() };
  const sessions = { findByIdInTeam: vi.fn() };
  const service = new PracticeLookupService(
    schedules as never,
    sessions as never,
  );
  return { service, schedules, sessions };
}

describe('PracticeLookupService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a schedule found in the team', async () => {
    harness.schedules.findByIdInTeam.mockResolvedValue({ id: 'sch-1' });
    await expect(
      harness.service.requireSchedule(SCOPE, 'team-1', 'sch-1'),
    ).resolves.toEqual({ id: 'sch-1' });
  });

  it('throws not-found for a missing/cross-team schedule', async () => {
    harness.schedules.findByIdInTeam.mockResolvedValue(null);
    await expect(
      harness.service.requireSchedule(SCOPE, 'team-1', 'sch-x'),
    ).rejects.toBeInstanceOf(PracticeScheduleNotFoundError);
  });

  it('returns a session found in the team', async () => {
    harness.sessions.findByIdInTeam.mockResolvedValue({ id: 'ses-1' });
    await expect(
      harness.service.requireSession(SCOPE, 'team-1', 'ses-1'),
    ).resolves.toEqual({ id: 'ses-1' });
  });

  it('throws not-found for a missing/cross-team session', async () => {
    harness.sessions.findByIdInTeam.mockResolvedValue(null);
    await expect(
      harness.service.requireSession(SCOPE, 'team-1', 'ses-x'),
    ).rejects.toBeInstanceOf(PracticeSessionNotFoundError);
  });
});
