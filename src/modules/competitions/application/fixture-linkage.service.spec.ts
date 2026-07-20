import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompetitionScopeNotFoundError } from '../errors/competition-scope-not-found.error';
import { OpponentNotFoundError } from '../errors/opponent-not-found.error';
import { MatchSide } from '../model/competitions.enums';
import type { FixtureContent } from '../model/competitions.types';
import { FixtureLinkageService } from './fixture-linkage.service';

const TX = {} as never;

function content(overrides: Partial<FixtureContent> = {}): FixtureContent {
  return {
    opponentId: 'opp-1',
    stageId: null,
    roundId: null,
    venueId: null,
    homeAway: MatchSide.Home,
    scheduledAt: '2026-01-15T18:30:00.000Z',
    ...overrides,
  };
}

function build() {
  const opponents = { activeInTeam: vi.fn().mockResolvedValue(true) };
  const stages = {
    stageInCompetition: vi.fn().mockResolvedValue(true),
    roundInStage: vi.fn().mockResolvedValue(true),
  };
  const service = new FixtureLinkageService(
    opponents as never,
    stages as never,
  );
  return { opponents, stages, service };
}

describe('FixtureLinkageService', () => {
  let harness: ReturnType<typeof build>;

  beforeEach(() => {
    harness = build();
  });

  it('passes when the opponent is active and no stage/round is linked', async () => {
    await expect(
      harness.service.validate(TX, 'team-1', 'comp-1', content()),
    ).resolves.toBeUndefined();
    expect(harness.stages.stageInCompetition).not.toHaveBeenCalled();
  });

  it('404s a missing opponent', async () => {
    harness.opponents.activeInTeam.mockResolvedValue(false);
    await expect(
      harness.service.validate(TX, 'team-1', 'comp-1', content()),
    ).rejects.toBeInstanceOf(OpponentNotFoundError);
  });

  it('404s a stage that is not in the competition', async () => {
    harness.stages.stageInCompetition.mockResolvedValue(false);
    await expect(
      harness.service.validate(
        TX,
        'team-1',
        'comp-1',
        content({ stageId: 'stage-1' }),
      ),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
  });

  it('validates a stage-linked fixture', async () => {
    await expect(
      harness.service.validate(
        TX,
        'team-1',
        'comp-1',
        content({ stageId: 'stage-1' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a round without its parent stage', async () => {
    await expect(
      harness.service.validate(
        TX,
        'team-1',
        'comp-1',
        content({ stageId: null, roundId: 'round-1' }),
      ),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
  });

  it('404s a round that is not in the stage', async () => {
    harness.stages.roundInStage.mockResolvedValue(false);
    await expect(
      harness.service.validate(
        TX,
        'team-1',
        'comp-1',
        content({ stageId: 'stage-1', roundId: 'round-1' }),
      ),
    ).rejects.toBeInstanceOf(CompetitionScopeNotFoundError);
  });

  it('validates a fully-linked stage and round', async () => {
    await expect(
      harness.service.validate(
        TX,
        'team-1',
        'comp-1',
        content({ stageId: 'stage-1', roundId: 'round-1' }),
      ),
    ).resolves.toBeUndefined();
  });
});
