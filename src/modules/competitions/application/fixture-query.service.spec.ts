import { describe, expect, it, vi } from 'vitest';

import { MatchSide } from '../model/competitions.enums';
import type { Fixture } from '../model/competitions.types';
import { FixtureQueryService } from './fixture-query.service';

function fixture(): Fixture {
  return {
    fixtureId: 'fixture-1',
    competitionId: 'comp-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    stageId: null,
    roundId: null,
    opponentId: 'opp-1',
    venueId: null,
    homeAway: MatchSide.Home,
    scheduledAt: new Date('2026-01-15T18:30:00.000Z'),
    status: 'scheduled' as never,
    rescheduleCount: 0,
    previousScheduledAt: null,
    rescheduleReason: null,
    cancellationReason: null,
    recordVersion: 1,
    createdBy: 'coach',
    rescheduledAt: null,
    finalizedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('FixtureQueryService', () => {
  it('resolves the competition then returns Cairo-presented fixtures', async () => {
    const tx = {} as never;
    const unitOfWork = {
      runInTransaction: vi.fn((op: (scope: never) => unknown) => op(tx)),
    };
    const repository = {
      listForCompetition: vi.fn().mockResolvedValue([fixture()]),
      countForCompetition: vi.fn().mockResolvedValue(1),
    };
    const lookup = {
      require: vi.fn().mockResolvedValue({ competitionId: 'comp-1' }),
    };
    const service = new FixtureQueryService(
      unitOfWork as never,
      repository as never,
      lookup as never,
    );
    const page = await service.listForCompetition('team-1', 'comp-1', {
      limit: 20,
      offset: 0,
    });
    expect(lookup.require).toHaveBeenCalledOnce();
    expect(page.total).toBe(1);
    expect(page.items[0]?.scheduledAtCairo).toBe('2026-01-15T20:30');
  });
});
