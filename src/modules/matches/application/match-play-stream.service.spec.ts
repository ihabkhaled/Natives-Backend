import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchPlayNotFoundError } from '../errors/match-play-not-found.error';
import { MatchPointNotOpenError } from '../errors/match-point-not-open.error';
import type { MatchPlayEventRepository } from '../infrastructure/match-play-event.repository';
import {
  CapKind,
  MatchPlayType,
  MatchResult,
  MatchStatus,
  PointStartingLine,
} from '../model/matches.enums';
import type {
  Match,
  MatchPlayEvent,
  NewMatchPlayEvent,
  OpenMatchPoint,
} from '../model/matches.types';
import { MatchPlayStreamService } from './match-play-stream.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-05-01T10:00:00.000Z');

function match(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: 'roster-1',
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 0,
    opponentScore: 0,
    period: 1,
    streamVersion: 0,
    recordVersion: 1,
    revision: 1,
    result: MatchResult.Undecided,
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
    completedAt: null,
    finalizedBy: null,
    finalizedAt: null,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function play(overrides: Partial<MatchPlayEvent> = {}): MatchPlayEvent {
  return {
    playId: 'play-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 1,
    operationId: 'op-1',
    requestHash: 'hash-1',
    playType: MatchPlayType.Goal,
    pointNumber: 1,
    period: 1,
    startingLine: null,
    scoringSide: null,
    primaryMembershipId: null,
    secondaryMembershipId: null,
    assistState: null,
    callahan: false,
    durationSeconds: null,
    correctsPlayId: null,
    correctionReason: null,
    retracted: false,
    notes: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
    ...overrides,
  };
}

function openPoint(): OpenMatchPoint {
  return {
    playId: 'start-1',
    pointNumber: 2,
    period: 1,
    startingLine: PointStartingLine.Offense,
  };
}

function repository(
  overrides: Partial<Record<string, unknown>> = {},
): MatchPlayEventRepository {
  return {
    findByOperationId: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    nextSequence: vi.fn().mockResolvedValue(4),
    countEffectiveStarts: vi.fn().mockResolvedValue(2),
    findOpenPoint: vi.fn().mockResolvedValue(null),
    append: vi.fn().mockResolvedValue(play()),
    ...overrides,
  } as unknown as MatchPlayEventRepository;
}

describe('MatchPlayStreamService', () => {
  it('resolves a faithful replay to the stored fact', async () => {
    const stored = play({ requestHash: 'hash-1' });
    const service = new MatchPlayStreamService(
      repository({ findByOperationId: vi.fn().mockResolvedValue(stored) }),
    );
    await expect(
      service.resolveReplay(TX, 'match-1', 'op-1', 'hash-1'),
    ).resolves.toBe(stored);
  });

  it('refuses the same operation id carrying a different payload', async () => {
    const service = new MatchPlayStreamService(
      repository({
        findByOperationId: vi.fn().mockResolvedValue(play()),
      }),
    );
    await expect(
      service.resolveReplay(TX, 'match-1', 'op-1', 'other-hash'),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
  });

  it('treats an unknown operation id as a fresh write', async () => {
    const service = new MatchPlayStreamService(repository());
    await expect(
      service.resolveReplay(TX, 'match-1', 'op-9', 'hash-9'),
    ).resolves.toBeNull();
  });

  it('refuses to append to a finalized match', () => {
    const service = new MatchPlayStreamService(repository());
    expect(() =>
      service.assertOpen(match({ status: MatchStatus.Finalized })),
    ).toThrow(MatchFinalizedError);
  });

  it('refuses to append while the match is not live', () => {
    const service = new MatchPlayStreamService(repository());
    expect(() =>
      service.assertOpen(match({ status: MatchStatus.Ready })),
    ).toThrow(MatchNotScoringError);
  });

  it('accepts an append while the match is live', () => {
    const service = new MatchPlayStreamService(repository());
    expect(() => service.assertOpen(match())).not.toThrow();
  });

  it('requires an open point to attach a fact to', () => {
    const service = new MatchPlayStreamService(repository());
    expect(() => service.requireOpenPoint(null)).toThrow(
      MatchPointNotOpenError,
    );
    expect(service.requireOpenPoint(openPoint())).toEqual(openPoint());
  });

  it('reads the open point through the repository', async () => {
    const findOpenPoint = vi.fn().mockResolvedValue(openPoint());
    const service = new MatchPlayStreamService(repository({ findOpenPoint }));
    await expect(service.findOpenPoint(TX, 'match-1')).resolves.toEqual(
      openPoint(),
    );
    expect(findOpenPoint).toHaveBeenCalledWith(TX, 'match-1');
  });

  it('takes the next sequence from the recorded stream', async () => {
    const service = new MatchPlayStreamService(repository());
    await expect(service.sequenceFor(TX, 'match-1')).resolves.toBe(4);
  });

  it('numbers the next point past the starts that still count', async () => {
    const service = new MatchPlayStreamService(repository());
    await expect(service.nextPointNumberFor(TX, 'match-1')).resolves.toBe(3);
  });

  it('appends through the repository', async () => {
    const append = vi.fn().mockResolvedValue(play());
    const service = new MatchPlayStreamService(repository({ append }));
    const created = await service.append(TX, {
      id: 'play-1',
    } as unknown as NewMatchPlayEvent);
    expect(created.playId).toBe('play-1');
    expect(append).toHaveBeenCalled();
  });

  it('resolves the retraction target when it exists and still counts', async () => {
    const target = play();
    const service = new MatchPlayStreamService(
      repository({ findById: vi.fn().mockResolvedValue(target) }),
    );
    await expect(service.requirePlay(TX, 'match-1', 'play-1')).resolves.toBe(
      target,
    );
  });

  it('reports an unknown retraction target as not found', async () => {
    const service = new MatchPlayStreamService(repository());
    await expect(
      service.requirePlay(TX, 'match-1', 'nope'),
    ).rejects.toBeInstanceOf(MatchPlayNotFoundError);
  });

  it('refuses to retract a fact a correction already retracted', async () => {
    const service = new MatchPlayStreamService(
      repository({
        findById: vi.fn().mockResolvedValue(play({ retracted: true })),
      }),
    );
    await expect(
      service.requirePlay(TX, 'match-1', 'play-1'),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
  });
});
