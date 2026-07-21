import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SeasonAlreadyActiveError } from '../errors/season-already-active.error';
import { SeasonInvalidTransitionError } from '../errors/season-invalid-transition.error';
import { SeasonNotFoundError } from '../errors/season-not-found.error';
import { SeasonStatus } from '../model/teams.enums';
import type { Season } from '../model/teams.types';
import { TransitionSeasonUseCase } from './transition-season.use-case';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const ACTOR = { userId: 'admin-1', email: 'a@example.test', roles: [] };
const SCOPE = {} as never;

function season(overrides: Partial<Season> = {}): Season {
  return {
    id: 'season-1',
    teamId: 'team-1',
    slug: 'spring-2026',
    name: 'Spring 2026',
    startsOn: '2026-01-01',
    endsOn: '2026-06-30',
    status: SeasonStatus.Draft,
    createdBy: 'admin-1',
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function build() {
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(SCOPE)),
  };
  const clock = { now: () => NOW, uptime: () => 0 };
  const idGenerator = { generate: vi.fn().mockReturnValue('generated') };
  const seasons = {
    findByIdInTeam: vi.fn(),
    hasOtherActive: vi.fn().mockResolvedValue(false),
    applyStatusChange: vi.fn(),
  };
  const audit = { append: vi.fn() };
  const useCase = new TransitionSeasonUseCase(
    unitOfWork as never,
    clock,
    idGenerator,
    seasons as never,
    audit,
  );
  return { audit, seasons, useCase };
}

function run(
  harness: ReturnType<typeof build>,
  target: SeasonStatus,
  expectedVersion: number | null = null,
) {
  return harness.useCase.execute(ACTOR, 'team-1', 'season-1', target, {
    expectedVersion,
  });
}

describe('TransitionSeasonUseCase', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('activates a draft season and audits the move', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.applyStatusChange.mockResolvedValue(
      season({ status: SeasonStatus.Active, version: 2 }),
    );

    const result = await run(harness, SeasonStatus.Active, 1);

    expect(result.status).toBe(SeasonStatus.Active);
    expect(harness.seasons.hasOtherActive).toHaveBeenCalledWith(
      SCOPE,
      'team-1',
      'season-1',
    );
    expect(harness.audit.append).toHaveBeenCalledOnce();
  });

  it('skips the current-season guard for a non-activating move', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(
      season({ status: SeasonStatus.Active }),
    );
    harness.seasons.applyStatusChange.mockResolvedValue(
      season({ status: SeasonStatus.Closed, version: 2 }),
    );

    await run(harness, SeasonStatus.Closed);

    expect(harness.seasons.hasOtherActive).not.toHaveBeenCalled();
  });

  it('reports not-found for a missing or cross-team season', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(null);

    await expect(run(harness, SeasonStatus.Active)).rejects.toBeInstanceOf(
      SeasonNotFoundError,
    );
  });

  it('rejects a move the state machine forbids', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());

    await expect(run(harness, SeasonStatus.Closed)).rejects.toBeInstanceOf(
      SeasonInvalidTransitionError,
    );
  });

  it('refuses a second current season for the team', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.hasOtherActive.mockResolvedValue(true);

    await expect(run(harness, SeasonStatus.Active)).rejects.toBeInstanceOf(
      SeasonAlreadyActiveError,
    );
    expect(harness.seasons.applyStatusChange).not.toHaveBeenCalled();
  });

  it('reports a version conflict when the guarded write misses', async () => {
    harness.seasons.findByIdInTeam.mockResolvedValue(season());
    harness.seasons.applyStatusChange.mockResolvedValue(null);

    await expect(run(harness, SeasonStatus.Active, 9)).rejects.toBeInstanceOf(
      OptimisticConflictError,
    );
  });
});
