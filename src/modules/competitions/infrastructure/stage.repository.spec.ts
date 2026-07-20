import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { StageFormat } from '../model/competitions.enums';
import type { RoundRow, StageRow } from '../model/competitions.rows';
import { StageRepository } from './stage.repository';

const NOW = new Date('2026-03-01T12:00:00.000Z');

function stageRow(overrides: Partial<StageRow> = {}): StageRow {
  return {
    id: 'stage-1',
    competition_id: 'comp-1',
    name: 'Group stage',
    stage_format: 'group',
    ordinal: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function roundRow(overrides: Partial<RoundRow> = {}): RoundRow {
  return {
    id: 'round-1',
    stage_id: 'stage-1',
    competition_id: 'comp-1',
    name: 'Round 1',
    ordinal: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function scope(rows: unknown[]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn().mockResolvedValue(rows);
  return { scope: { run }, run };
}

describe('StageRepository', () => {
  const repository = new StageRepository();

  it('computes the next stage and round ordinals with a fallback', async () => {
    expect(
      await repository.nextStageOrdinal(
        scope([{ next_ordinal: 3 }]).scope,
        'c',
      ),
    ).toBe(3);
    expect(await repository.nextStageOrdinal(scope([]).scope, 'c')).toBe(1);
    expect(
      await repository.nextRoundOrdinal(
        scope([{ next_ordinal: 2 }]).scope,
        's',
      ),
    ).toBe(2);
    expect(await repository.nextRoundOrdinal(scope([]).scope, 's')).toBe(1);
  });

  it('inserts a stage and a round, returning the mapped rows', async () => {
    const stage = await repository.insertStage(scope([stageRow()]).scope, {
      id: 'stage-1',
      competitionId: 'comp-1',
      name: 'Group stage',
      stageFormat: StageFormat.Group,
      ordinal: 1,
      now: NOW,
    });
    expect(stage.stageId).toBe('stage-1');
    const round = await repository.insertRound(scope([roundRow()]).scope, {
      id: 'round-1',
      stageId: 'stage-1',
      competitionId: 'comp-1',
      name: 'Round 1',
      ordinal: 1,
      now: NOW,
    });
    expect(round.roundId).toBe('round-1');
  });

  it('throws when a stage or round write returns no row', async () => {
    await expect(
      repository.insertStage(scope([]).scope, {
        id: 'stage-1',
        competitionId: 'comp-1',
        name: 'Group',
        stageFormat: StageFormat.Group,
        ordinal: 1,
        now: NOW,
      }),
    ).rejects.toThrow('Expected a returned row');
    await expect(
      repository.insertRound(scope([]).scope, {
        id: 'round-1',
        stageId: 'stage-1',
        competitionId: 'comp-1',
        name: 'Round 1',
        ordinal: 1,
        now: NOW,
      }),
    ).rejects.toThrow('Expected a returned row');
  });

  it('reports stage and round membership', async () => {
    expect(
      await repository.stageInCompetition(
        scope([{ id: 'stage-1' }]).scope,
        'comp-1',
        'stage-1',
      ),
    ).toBe(true);
    expect(
      await repository.stageInCompetition(scope([]).scope, 'comp-1', 'stage-1'),
    ).toBe(false);
    expect(
      await repository.roundInStage(
        scope([{ id: 'round-1' }]).scope,
        'comp-1',
        'stage-1',
        'round-1',
      ),
    ).toBe(true);
    expect(
      await repository.roundInStage(
        scope([]).scope,
        'comp-1',
        'stage-1',
        'round-1',
      ),
    ).toBe(false);
  });

  it('lists stages and rounds in order', async () => {
    const stages = await repository.listStages(
      scope([stageRow(), stageRow({ id: 'stage-2', ordinal: 2 })]).scope,
      'comp-1',
    );
    expect(stages).toHaveLength(2);
    const rounds = await repository.listRounds(
      scope([roundRow(), roundRow({ id: 'round-2', ordinal: 2 })]).scope,
      'comp-1',
    );
    expect(rounds).toHaveLength(2);
  });
});
