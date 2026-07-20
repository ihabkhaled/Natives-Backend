import type { AuthUserIdentity } from '@core/auth';
import { describe, expect, it, vi } from 'vitest';

import { CompetitionScopeNotFoundError } from '../errors/competition-scope-not-found.error';
import { CreateRoundUseCase } from './create-round.use-case';

const ACTOR: AuthUserIdentity = {
  userId: 'coach',
  email: 'c@x.test',
  roles: [],
};

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const clock = {
    now: vi.fn().mockReturnValue(new Date('2026-02-01T00:00:00Z')),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('round-1') };
  const lookup = {
    require: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
  };
  const repository = {
    stageInCompetition: vi.fn().mockResolvedValue(true),
    nextRoundOrdinal: vi.fn().mockResolvedValue(1),
    insertRound: vi.fn().mockResolvedValue({ roundId: 'round-1', ordinal: 1 }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateRoundUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    lookup as never,
    repository as never,
    audit as never,
  );
  return { lookup, repository, audit, useCase };
}

describe('CreateRoundUseCase', () => {
  it('writes a round when the stage belongs to the competition', async () => {
    const harness = build();
    const round = await harness.useCase.execute(ACTOR, 'team-1', 'comp-1', {
      content: { stageId: 'stage-1', name: 'Round 1' },
    });
    expect(round.roundId).toBe('round-1');
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });

  it('404s a stage that is not in the competition', async () => {
    const harness = build();
    harness.repository.stageInCompetition.mockResolvedValue(false);
    await expect(
      harness.useCase.execute(ACTOR, 'team-1', 'comp-1', {
        content: { stageId: 'stage-x', name: 'Round 1' },
      }),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
    expect(harness.repository.insertRound).not.toHaveBeenCalled();
  });
});
