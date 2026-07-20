import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
import {
  ID_GENERATOR_PORT,
  type IdGeneratorPort,
} from '@core/id-generator/id-generator.port';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { AuditRecorderService } from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { resolveScoreState, revertPoint } from '../domain/match-score.policy';
import { MatchEventNotFoundError } from '../errors/match-event-not-found.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { hashVoidOperation } from '../lib/match-operation.hash';
import { resolveElapsedMinutes } from '../lib/match-scoreboard.factory';
import {
  buildEventAudit,
  buildVoidEvent,
  toScore,
} from '../lib/matches.builders';
import { MATCH_EVENT_VOIDED_ACTION } from '../model/matches.constants';
import { MatchEventType, OperationOutcome } from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  MatchOperationResult,
  ScorePair,
  VoidEventCommand,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchStreamService } from './match-stream.service';

/**
 * Undoes a recorded fact by APPENDING a compensating void (match.score). The
 * original row is never rewritten or deleted — the database refuses that — so the
 * stream stays a complete, replayable history and the corrected score is still a
 * projection of it rather than an edited number.
 *
 * Voiding is itself idempotent on the caller's operation id, and an event that a
 * previous void already compensated cannot be voided twice.
 */
@Injectable()
export class VoidMatchEventUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly stream: MatchStreamService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: VoidEventCommand,
  ): Promise<MatchOperationResult> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, matchId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: VoidEventCommand,
  ): Promise<MatchOperationResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashVoidOperation(command.content);
    const replay = await this.stream.resolveReplay(
      tx,
      matchId,
      command.content.operationId,
      hash,
    );
    if (replay !== null) {
      return this.replayed(match, replay);
    }
    return this.apply(tx, actor, match, command, hash);
  }

  private async apply(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: VoidEventCommand,
    hash: string,
  ): Promise<MatchOperationResult> {
    this.stream.assertOpen(match);
    const target = await this.stream.findEvent(
      tx,
      match.matchId,
      command.content.eventId,
    );
    if (target === null) {
      throw new MatchEventNotFoundError();
    }
    if (target.voided) {
      throw new MatchOperationConflictError();
    }
    return this.append(tx, actor, match, command, hash, target);
  }

  private async append(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: VoidEventCommand,
    hash: string,
    target: MatchEvent,
  ): Promise<MatchOperationResult> {
    const score = this.revert(match, target);
    const sequence = this.stream.sequenceFor(match);
    const event = await this.stream.append(
      tx,
      buildVoidEvent(
        this.idGenerator.generate(),
        match,
        command.content,
        hash,
        sequence,
        score,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.project(tx, actor, match, event, score, sequence);
  }

  private revert(match: Match, target: MatchEvent): ScorePair {
    if (
      target.eventType !== MatchEventType.Point ||
      target.scoringSide === null ||
      target.points === null
    ) {
      return toScore(match);
    }
    return revertPoint(toScore(match), target.scoringSide, target.points);
  }

  private async project(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    event: MatchEvent,
    score: ScorePair,
    sequence: number,
  ): Promise<MatchOperationResult> {
    const ruleset = await this.lookup.requireRuleset(
      tx,
      match.teamId,
      match.rulesetId,
    );
    const state = resolveScoreState(
      ruleset,
      score,
      resolveElapsedMinutes(match, this.clock.now()),
    );
    const updated = await this.stream.advance(
      tx,
      match,
      score,
      sequence,
      state.capApplied,
      this.clock.now(),
    );
    await this.audit.record(
      tx,
      buildEventAudit(MATCH_EVENT_VOIDED_ACTION, actor.userId, updated, event),
    );
    return {
      outcome: OperationOutcome.Applied,
      event,
      streamVersion: updated.streamVersion,
      ourScore: updated.ourScore,
      opponentScore: updated.opponentScore,
    };
  }

  private replayed(match: Match, event: MatchEvent): MatchOperationResult {
    return {
      outcome: OperationOutcome.Replayed,
      event,
      streamVersion: match.streamVersion,
      ourScore: match.ourScore,
      opponentScore: match.opponentScore,
    };
  }
}
