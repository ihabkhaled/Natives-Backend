import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MeasurementSessionNotFoundError } from '../errors/measurement-session-not-found.error';
import { SessionQueryService } from './session-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const sessions = {
    listForTeam: vi.fn(),
    countForTeam: vi.fn(),
    findForWrite: vi.fn(),
  };
  const attempts = { listForSession: vi.fn() };
  return {
    sessions,
    attempts,
    service: new SessionQueryService(
      unitOfWork as never,
      sessions as never,
      attempts as never,
    ),
  };
}

describe('SessionQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a bounded page for a team', async () => {
    harness.sessions.listForTeam.mockResolvedValue([{ id: 'session-1' }]);
    harness.sessions.countForTeam.mockResolvedValue(1);
    await expect(
      harness.service.listForTeam('team-1', { limit: 20, offset: 0 }),
    ).resolves.toMatchObject({ total: 1 });
  });

  it('returns a session with its attempts or 404s', async () => {
    harness.sessions.findForWrite.mockResolvedValueOnce({ id: 'session-1' });
    harness.attempts.listForSession.mockResolvedValueOnce([
      { id: 'attempt-1' },
    ]);
    await expect(
      harness.service.getDetail('team-1', 'session-1'),
    ).resolves.toEqual({
      session: { id: 'session-1' },
      attempts: [{ id: 'attempt-1' }],
    });
    harness.sessions.findForWrite.mockResolvedValueOnce(null);
    await expect(
      harness.service.getDetail('team-1', 'session-1'),
    ).rejects.toThrow(MeasurementSessionNotFoundError);
  });
});
