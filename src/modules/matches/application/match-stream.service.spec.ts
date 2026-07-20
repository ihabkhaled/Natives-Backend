import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import type { MatchRepository } from '../infrastructure/match.repository';
import type { MatchEventRepository } from '../infrastructure/match-event.repository';
import {
  CapKind,
  MatchEventType,
  MatchResult,
  MatchStatus,
  ScoringSide,
} from '../model/matches.enums';
import type { Match, MatchEvent } from '../model/matches.types';
import { MatchStreamService } from './match-stream.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const NOW = new Date('2026-03-01T10:00:00.000Z');

function match(overrides: Partial<Match> = {}): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: null,
    rulesetId: 'rules-1',
    status: MatchStatus.Live,
    homeAway: 'home',
    ourScore: 3,
    opponentScore: 2,
    period: 1,
    streamVersion: 5,
    recordVersion: 3,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'user-1',
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

function event(requestHash: string): MatchEvent {
  return {
    eventId: 'event-1',
    matchId: 'match-1',
    teamId: 'team-1',
    sequence: 5,
    operationId: 'op-abcdef01',
    requestHash,
    eventType: MatchEventType.Point,
    scoringSide: ScoringSide.Us,
    points: 1,
    ourScoreAfter: 3,
    opponentScoreAfter: 2,
    period: 1,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: null,
    voided: false,
    voidReason: null,
    recordedBy: 'user-1',
    occurredAt: null,
    recordedAt: NOW,
  };
}

function build(options: {
  existing?: MatchEvent | null;
  updated?: Match | null;
  target?: MatchEvent | null;
}): {
  service: MatchStreamService;
  applyScoreUpdate: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
} {
  const applyScoreUpdate = vi
    .fn()
    .mockResolvedValue('updated' in options ? options.updated : match());
  const append = vi.fn().mockResolvedValue(event('hash-a'));
  const service = new MatchStreamService(
    { applyScoreUpdate } as unknown as MatchRepository,
    {
      findByOperationId: vi.fn().mockResolvedValue(options.existing ?? null),
      findById: vi.fn().mockResolvedValue(options.target ?? null),
      append,
    } as unknown as MatchEventRepository,
  );
  return { service, applyScoreUpdate, append };
}

describe('MatchStreamService', () => {
  it('treats an unseen operation id as new work', async () => {
    const { service } = build({});
    await expect(
      service.resolveReplay(TX, 'match-1', 'op-abcdef01', 'hash-a'),
    ).resolves.toBeNull();
  });

  it('returns the stored fact for a faithful offline replay', async () => {
    const stored = event('hash-a');
    const { service } = build({ existing: stored });
    await expect(
      service.resolveReplay(TX, 'match-1', 'op-abcdef01', 'hash-a'),
    ).resolves.toBe(stored);
  });

  it('refuses the same operation id carrying a different payload', async () => {
    const { service } = build({ existing: event('hash-a') });
    await expect(
      service.resolveReplay(TX, 'match-1', 'op-abcdef01', 'hash-b'),
    ).rejects.toBeInstanceOf(MatchOperationConflictError);
  });

  it('refuses a stream write on a finalized match', () => {
    const { service } = build({});
    expect(() =>
      service.assertOpen(match({ status: MatchStatus.Finalized })),
    ).toThrow(MatchFinalizedError);
  });

  it('refuses a stream write while a match is not live', () => {
    const { service } = build({});
    expect(() =>
      service.assertOpen(match({ status: MatchStatus.Halftime })),
    ).toThrow(MatchNotScoringError);
    expect(() => service.assertOpen(match())).not.toThrow();
  });

  it('accepts an unclaimed base version and rejects a stale one', () => {
    const { service } = build({});
    expect(() => service.assertStreamVersion(null, 5)).not.toThrow();
    expect(() => service.assertStreamVersion(5, 5)).not.toThrow();
    expect(() => service.assertStreamVersion(4, 5)).toThrow(
      MatchVersionConflictError,
    );
  });

  it('numbers the next fact one past the stream version', () => {
    const { service } = build({});
    expect(service.sequenceFor(match())).toBe(6);
  });

  it('appends through the repository unchanged', async () => {
    const { service, append } = build({});
    const appended = await service.append(TX, {
      id: 'event-2',
      matchId: 'match-1',
      teamId: 'team-1',
      sequence: 6,
      operationId: 'op-abcdef02',
      requestHash: 'hash-b',
      eventType: MatchEventType.Point,
      scoringSide: ScoringSide.Us,
      points: 1,
      ourScoreAfter: 4,
      opponentScoreAfter: 2,
      period: 1,
      scorerMembershipId: null,
      assistMembershipId: null,
      voidsEventId: null,
      voidReason: null,
      recordedBy: 'user-1',
      occurredAt: null,
      now: NOW,
    });
    expect(appended.eventId).toBe('event-1');
    expect(append).toHaveBeenCalledOnce();
  });

  it('resolves a fact by id for a void operation', async () => {
    const target = event('hash-a');
    const { service } = build({ target });
    await expect(service.findEvent(TX, 'match-1', 'event-1')).resolves.toBe(
      target,
    );
  });

  it('advances the score projection under the stream-version guard', async () => {
    const { service, applyScoreUpdate } = build({});
    const updated = await service.advance(
      TX,
      match(),
      { ourScore: 4, opponentScore: 2 },
      6,
      CapKind.None,
      NOW,
    );
    expect(updated.matchId).toBe('match-1');
    expect(applyScoreUpdate.mock.calls[0]?.[1]).toMatchObject({
      ourScore: 4,
      opponentScore: 2,
      streamVersion: 6,
    });
  });

  it('raises a version conflict when a concurrent device already advanced', async () => {
    const { service } = build({ updated: null });
    await expect(
      service.advance(
        TX,
        match(),
        { ourScore: 4, opponentScore: 2 },
        6,
        CapKind.None,
        NOW,
      ),
    ).rejects.toBeInstanceOf(MatchVersionConflictError);
  });
});
