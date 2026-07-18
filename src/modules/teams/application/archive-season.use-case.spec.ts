import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SeasonNotFoundError } from '../errors/season-not-found.error';
import { SeasonStatus } from '../model/teams.enums';
import type { Season } from '../model/teams.types';
import { ArchiveSeasonUseCase } from './archive-season.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

const SEASON: Season = {
  id: 'season-1',
  teamId: 'team-1',
  slug: 'spring-2026',
  name: 'Spring 2026',
  startsOn: '2026-01-01',
  endsOn: '2026-06-30',
  status: SeasonStatus.Archived,
  createdBy: 'admin-1',
  updatedBy: 'admin-1',
  createdAt: NOW,
  updatedAt: NOW,
  version: 2,
};

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const seasons = { archive: vi.fn() };
  const audit = { append: vi.fn() };
  const useCase = new ArchiveSeasonUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    seasons as never,
    audit,
  );
  return { useCase, seasons, audit };
}

describe('ArchiveSeasonUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('archives a season and audits', async () => {
    harness.seasons.archive.mockResolvedValue(SEASON);
    const result = await harness.useCase.execute(ACTOR, 'team-1', 'season-1');
    expect(result.status).toBe(SeasonStatus.Archived);
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('reports not-found for a missing, cross-team, or already-archived season', async () => {
    harness.seasons.archive.mockResolvedValue(null);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'season-1'),
    ).rejects.toBeInstanceOf(SeasonNotFoundError);
  });
});
