import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoreProjectionNotFoundError } from '../errors/score-projection-not-found.error';
import { ScoreQueryService } from './score-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((cb: (t: never) => unknown) => cb(tx)),
  };
  const repository = {
    listForTeam: vi.fn(() => [{ id: 'proj-1' }]),
    countForTeam: vi.fn(() => 1),
    listForMembership: vi.fn(() => [{ id: 'proj-1' }]),
    listForUser: vi.fn(() => [{ id: 'proj-1' }]),
  };
  const service = new ScoreQueryService(
    unitOfWork as never,
    repository as never,
  );
  return { repository, service };
}

describe('ScoreQueryService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('returns a bounded page of team projections', async () => {
    await expect(
      harness.service.listForTeam('team-1', { limit: 20, offset: 0 }),
    ).resolves.toEqual({
      items: [{ id: 'proj-1' }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('returns a member’s projections or 404s when none exist', async () => {
    await expect(
      harness.service.getForMembership('team-1', 'mem-1'),
    ).resolves.toEqual({ items: [{ id: 'proj-1' }] });
    harness.repository.listForMembership.mockReturnValueOnce([]);
    await expect(
      harness.service.getForMembership('team-1', 'mem-1'),
    ).rejects.toBeInstanceOf(ScoreProjectionNotFoundError);
  });

  it('returns the caller’s own projections', async () => {
    await expect(
      harness.service.getForUser('team-1', 'user-1'),
    ).resolves.toEqual({ items: [{ id: 'proj-1' }] });
  });
});
