import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { isMatchFinalized, isScoringOpen } from '../domain/match.state-machine';
import {
  classifyOperation,
  isOperationConflict,
  isOperationReplay,
  matchesStreamVersion,
  nextSequence,
} from '../domain/match-operation.policy';
import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import { MatchRepository } from '../infrastructure/match.repository';
import { MatchEventRepository } from '../infrastructure/match-event.repository';
import { buildMatchScoreUpdate } from '../lib/matches.builders';
import type { CapKind } from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  NewMatchEvent,
  ScorePair,
} from '../model/matches.types';

/**
 * The shared mechanics every stream write goes through: the idempotency probe on
 * the client operation id, the scoring-window guard, the append, and the guarded
 * score projection.
 *
 * This is the seam prompt 811's offline scorekeeper relies on — a replayed
 * operation resolves to the stored fact rather than appending a second one, and a
 * differing payload under the same id is refused as a conflict instead of being
 * merged into the score.
 */
@Injectable()
export class MatchStreamService {
  constructor(
    private readonly matches: MatchRepository,
    private readonly events: MatchEventRepository,
  ) {}

  /** The stored fact when this operation id is a faithful replay, else null. */
  async resolveReplay(
    tx: TransactionScope,
    matchId: string,
    operationId: string,
    requestHash: string,
  ): Promise<MatchEvent | null> {
    const existing = await this.events.findByOperationId(
      tx,
      matchId,
      operationId,
    );
    const outcome = classifyOperation(existing, requestHash);
    if (isOperationConflict(outcome)) {
      throw new MatchOperationConflictError();
    }
    return isOperationReplay(outcome) ? existing : null;
  }

  /** Only a live match accepts stream writes; a finalized one never does. */
  assertOpen(match: Match): void {
    if (isMatchFinalized(match.status)) {
      throw new MatchFinalizedError();
    }
    if (!isScoringOpen(match.status)) {
      throw new MatchNotScoringError();
    }
  }

  /** Reject an offline device whose claimed base version is already stale. */
  assertStreamVersion(expected: number | null, actual: number): void {
    if (!matchesStreamVersion(expected, actual)) {
      throw new MatchVersionConflictError();
    }
  }

  /** The sequence the next appended fact takes on this match's stream. */
  sequenceFor(match: Match): number {
    return nextSequence(match.streamVersion);
  }

  append(tx: TransactionScope, event: NewMatchEvent): Promise<MatchEvent> {
    return this.events.append(tx, event);
  }

  /** One recorded fact of a match, with its derived voided flag. */
  findEvent(
    tx: TransactionScope,
    matchId: string,
    eventId: string,
  ): Promise<MatchEvent | null> {
    return this.events.findById(tx, matchId, eventId);
  }

  /**
   * Move the score projection forward with the stream under the stream-version
   * guard, so two devices appending concurrently cannot both win.
   */
  async advance(
    tx: TransactionScope,
    match: Match,
    score: ScorePair,
    streamVersion: number,
    capApplied: CapKind,
    now: Date,
  ): Promise<Match> {
    const updated = await this.matches.applyScoreUpdate(
      tx,
      buildMatchScoreUpdate(match, score, streamVersion, capApplied, now),
    );
    if (updated === null) {
      throw new MatchVersionConflictError();
    }
    return updated;
  }
}
