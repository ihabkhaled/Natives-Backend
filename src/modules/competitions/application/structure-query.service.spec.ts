import { describe, expect, it, vi } from 'vitest';

import { StructureQueryService } from './structure-query.service';

function build() {
  const tx = {} as never;
  const unitOfWork = {
    runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
  };
  const repository = {
    listStages: vi.fn().mockResolvedValue([{ stageId: 'stage-1' }]),
    listRounds: vi.fn().mockResolvedValue([{ roundId: 'round-1' }]),
  };
  const lookup = {
    require: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
  };
  const service = new StructureQueryService(
    unitOfWork as never,
    repository as never,
    lookup as never,
  );
  return { repository, lookup, service };
}

describe('StructureQueryService', () => {
  it('returns the stages and rounds after resolving the competition', async () => {
    const harness = build();
    const structure = await harness.service.getStructure('team-1', 'comp-1');
    expect(harness.lookup.require).toHaveBeenCalledOnce();
    expect(structure.stages).toHaveLength(1);
    expect(structure.rounds).toHaveLength(1);
  });
});
