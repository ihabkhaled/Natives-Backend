import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { isMatchFinalized, isScoringOpen } from '../domain/match.state-machine';
import {
  classifyOperation,
  isOperationConflict,
  isOperationReplay,
} from '../domain/match-operation.policy';
import { nextPointNumber } from '../domain/match-point.state-machine';
import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchNotScoringError } from '../errors/match-not-scoring.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchPlayNotFoundError } from '../errors/match-play-not-found.error';
import { MatchPointNotOpenError } from '../errors/match-point-not-open.error';
import { MatchPlayEventRepository } from '../infrastructure/match-play-event.repository';
import type {
  Match,
  MatchPlayEvent,
  NewMatchPlayEvent,
  OpenMatchPoint,
} from '../model/matches.types';

/**
 * The shared mechanics every point-stream write goes through: the idempotency
 * probe on the client operation id, the scoring-window guard, the open-point
 * lookup, the point numbering, and the append itself.
 *
 * A replayed operation resolves to the stored fact rather than appending a second
 * one, and the same id carrying a different payload is refused as a conflict
 * instead of quietly rewriting a lineup or double-counting a goal.
 */
@Injectable()
export class MatchPlayStreamService {
  constructor(private readonly plays: MatchPlayEventRepository) {}

  /** The stored fact when this operation id is a faithful replay, else null. */
  async resolveReplay(
    tx: TransactionScope,
    matchId: string,
    operationId: string,
    requestHash: string,
  ): Promise<MatchPlayEvent | null> {
    const existing = await this.plays.findByOperationId(
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

  findOpenPoint(
    tx: TransactionScope,
    matchId: string,
  ): Promise<OpenMatchPoint | null> {
    return this.plays.findOpenPoint(tx, matchId);
  }

  /** The open point a completion or possession fact must attach to. */
  requireOpenPoint(open: OpenMatchPoint | null): OpenMatchPoint {
    if (open === null) {
      throw new MatchPointNotOpenError();
    }
    return open;
  }

  sequenceFor(tx: TransactionScope, matchId: string): Promise<number> {
    return this.plays.nextSequence(tx, matchId);
  }

  /** One past the point-starts a correction has not retracted. */
  async nextPointNumberFor(
    tx: TransactionScope,
    matchId: string,
  ): Promise<number> {
    return nextPointNumber(await this.plays.countEffectiveStarts(tx, matchId));
  }

  append(
    tx: TransactionScope,
    play: NewMatchPlayEvent,
  ): Promise<MatchPlayEvent> {
    return this.plays.append(tx, play);
  }

  /** The retraction target: it must exist on this match and still count. */
  async requirePlay(
    tx: TransactionScope,
    matchId: string,
    playId: string,
  ): Promise<MatchPlayEvent> {
    const target = await this.plays.findById(tx, matchId, playId);
    if (target === null) {
      throw new MatchPlayNotFoundError();
    }
    if (target.retracted) {
      throw new MatchOperationConflictError();
    }
    return target;
  }
}
