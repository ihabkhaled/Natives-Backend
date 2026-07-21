import type { AuthUserIdentity } from '@core/auth';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchNotFoundError } from '../errors/match-not-found.error';
import {
  MATCH_STATS_ENGINE_VERSION,
  MATCH_STATS_PROJECTED_EVENT,
} from '../model/matches.constants';
import { CapKind, MatchResult, MatchStatus } from '../model/matches.enums';
import type { Match, MatchStatistics } from '../model/matches.types';
import type { MatchLookupService } from './match-lookup.service';
import type { MatchStatisticsService } from './match-statistics.service';
import { RebuildMatchStatisticsUseCase } from './rebuild-match-statistics.use-case';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-05-01T10:00:00.000Z');
const ACTOR: AuthUserIdentity = {
  userId: 'analyst-1',
  email: 'analyst@example.test',
  roles: [],
};

function match(): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: 'roster-1',
    rulesetId: 'rules-1',
    status: MatchStatus.Finalized,
    homeAway: 'home',
    ourScore: 2,
    opponentScore: 1,
    period: 1,
    streamVersion: 6,
    recordVersion: 5,
    revision: 1,
    result: MatchResult.Win,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'coach-1',
    startedAt: NOW,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: NOW,
    finalizedBy: 'admin-1',
    finalizedAt: NOW,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function statistics(): MatchStatistics {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 3,
    statsEngineVersion: MATCH_STATS_ENGINE_VERSION,
    lineupsRecorded: true,
    playsRecorded: true,
    opponentErrorAttribution: false,
    team: {
      pointsStarted: 3,
      pointsCompleted: 3,
      holds: 2,
      breaks: 0,
      opponentHolds: 1,
      opponentBreaks: 0,
      goalsFor: 2,
      goalsAgainst: 1,
      drops: 1,
      throwaways: 0,
      blocks: 1,
      turnovers: 1,
      opponentErrors: null,
    },
    players: [
      {
        membershipId: 'ana',
        rosterEntryId: 'entry-ana',
        rostered: true,
        pointsPlayed: 3,
        offencePointsPlayed: 2,
        defencePointsPlayed: 1,
        goals: 2,
        assists: 0,
        callahans: 0,
        drops: 1,
        throwaways: 0,
        blocks: 1,
        opponentErrorsForced: null,
      },
    ],
  };
}

interface Harness {
  readonly useCase: RebuildMatchStatisticsUseCase;
  readonly projectFor: ReturnType<typeof vi.fn>;
  readonly audit: ReturnType<typeof vi.fn>;
  readonly enqueue: ReturnType<typeof vi.fn>;
}

function harness(missing = false): Harness {
  const projectFor = vi.fn().mockResolvedValue(statistics());
  const audit = vi.fn().mockResolvedValue(undefined);
  const enqueue = vi.fn().mockResolvedValue(undefined);
  const lookup = {
    require: missing
      ? vi.fn().mockRejectedValue(new MatchNotFoundError())
      : vi.fn().mockResolvedValue(match()),
  } as unknown as MatchLookupService;
  return {
    useCase: new RebuildMatchStatisticsUseCase(
      UOW,
      lookup,
      { projectFor } as unknown as MatchStatisticsService,
      { record: audit } as unknown as AuditRecorderService,
      { enqueue } as unknown as RecordDomainEventService,
    ),
    projectFor,
    audit,
    enqueue,
  };
}

describe('RebuildMatchStatisticsUseCase', () => {
  it('re-derives through the same pure engine the read path uses', async () => {
    const { useCase, projectFor } = harness();
    const rebuilt = await useCase.execute(ACTOR, 'team-1', 'match-1');
    expect(projectFor).toHaveBeenCalledWith(TX, match());
    expect(rebuilt).toEqual(statistics());
  });

  it('writes no stored total — it only publishes and audits', async () => {
    const { useCase, audit } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1');
    expect(TX.run).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledTimes(1);
  });

  it('publishes match.stats_projected citing the engine and ruleset version', async () => {
    const { useCase, enqueue } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1');
    const event = enqueue.mock.calls[0]?.[1];
    expect(event.eventType).toBe(MATCH_STATS_PROJECTED_EVENT);
    expect(event.payload.statsEngineVersion).toBe(MATCH_STATS_ENGINE_VERSION);
    expect(event.payload.rulesetVersion).toBe(3);
    expect(event.payload.playerCount).toBe(1);
  });

  it('audits the rebuild without carrying a player identity', async () => {
    const { useCase, audit } = harness();
    await useCase.execute(ACTOR, 'team-1', 'match-1');
    const entry = audit.mock.calls[0]?.[1];
    expect(entry.actorUserId).toBe('analyst-1');
    expect(entry.diff.playerCount).toBe(1);
    expect(JSON.stringify(entry.diff)).not.toContain('ana');
  });

  it('rebuilds a finalized match without touching its immutable record', async () => {
    const { useCase } = harness();
    await expect(
      useCase.execute(ACTOR, 'team-1', 'match-1'),
    ).resolves.toMatchObject({ matchId: 'match-1' });
  });

  it('hides another team’s match behind a not-found', async () => {
    await expect(
      harness(true).useCase.execute(ACTOR, 'team-9', 'match-1'),
    ).rejects.toBeInstanceOf(MatchNotFoundError);
  });
});
