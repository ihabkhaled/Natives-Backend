import type { AuthUserIdentity } from '@core/auth';
import { describe, expect, it, vi } from 'vitest';

import { StageFormat } from '../model/competitions.enums';
import { CreateStageUseCase } from './create-stage.use-case';

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
  const idGenerator = { generate: vi.fn().mockReturnValue('stage-1') };
  const lookup = {
    require: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
  };
  const repository = {
    nextStageOrdinal: vi.fn().mockResolvedValue(2),
    insertStage: vi.fn().mockResolvedValue({ stageId: 'stage-1', ordinal: 2 }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const useCase = new CreateStageUseCase(
    unitOfWork as never,
    clock as never,
    idGenerator,
    lookup as never,
    repository as never,
    audit as never,
  );
  return { lookup, repository, audit, useCase };
}

describe('CreateStageUseCase', () => {
  it('resolves the competition, assigns the next ordinal, writes and audits', async () => {
    const harness = build();
    const stage = await harness.useCase.execute(ACTOR, 'team-1', 'comp-1', {
      content: { name: 'Knockout', stageFormat: StageFormat.Knockout },
    });
    expect(harness.lookup.require).toHaveBeenCalledOnce();
    expect(harness.repository.nextStageOrdinal).toHaveBeenCalledWith(
      expect.anything(),
      'comp-1',
    );
    expect(stage.ordinal).toBe(2);
    expect(harness.audit.record).toHaveBeenCalledOnce();
  });
});
