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

import { applyPoint, resolveScoreState } from '../domain/match-score.policy';
import { hashPointOperation } from '../lib/match-operation.hash';
import { resolveElapsedMinutes } from '../lib/match-scoreboard.factory';
import {
  buildEventAudit,
  buildPointEvent,
  toScore,
} from '../lib/matches.builders';
import { toOptionalInstant } from '../lib/matches.helpers';
import { MATCH_SCORED_ACTION } from '../model/matches.constants';
import { OperationOutcome } from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  MatchOperationResult,
  RecordPointCommand,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchScopeService } from './match-scope.service';
import { MatchStreamService } from './match-stream.service';

/**
 * Records one point on the authoritative stream (match.score).
 *
 * The operation is IDEMPOTENT on the caller's operation id: an offline
 * scorekeeper replaying the same operation gets the stored fact and exactly one
 * score change, while the same id carrying a different payload is rejected as a
 * conflict rather than merged. The resulting score is a projection of the stream,
 * re-evaluated against the match's VERSIONED ruleset so caps are applied from
 * data, never from a hard-coded rule. All effects commit in one transaction.
 */
@Injectable()
export class RecordMatchPointUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly scope: MatchScopeService,
    private readonly stream: MatchStreamService,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: RecordPointCommand,
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
    command: RecordPointCommand,
  ): Promise<MatchOperationResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashPointOperation(command.content);
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
    command: RecordPointCommand,
    hash: string,
  ): Promise<MatchOperationResult> {
    this.stream.assertOpen(match);
    this.stream.assertStreamVersion(
      command.content.expectedStreamVersion,
      match.streamVersion,
    );
    await this.assertParticipants(tx, match, command);
    return this.append(tx, actor, match, command, hash);
  }

  private async assertParticipants(
    tx: TransactionScope,
    match: Match,
    command: RecordPointCommand,
  ): Promise<void> {
    await this.scope.requireMembership(
      tx,
      match.teamId,
      command.content.scorerMembershipId,
    );
    await this.scope.requireMembership(
      tx,
      match.teamId,
      command.content.assistMembershipId,
    );
  }

  private async append(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: RecordPointCommand,
    hash: string,
  ): Promise<MatchOperationResult> {
    const score = applyPoint(
      toScore(match),
      command.content.scoringSide,
      command.content.points,
    );
    const sequence = this.stream.sequenceFor(match);
    const event = await this.stream.append(
      tx,
      buildPointEvent(
        this.idGenerator.generate(),
        match,
        command.content,
        hash,
        sequence,
        score,
        toOptionalInstant(command.content.occurredAt),
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.project(tx, actor, match, event, sequence);
  }

  private async project(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    event: MatchEvent,
    sequence: number,
  ): Promise<MatchOperationResult> {
    const ruleset = await this.lookup.requireRuleset(
      tx,
      match.teamId,
      match.rulesetId,
    );
    const score = {
      ourScore: event.ourScoreAfter,
      opponentScore: event.opponentScoreAfter,
    };
    const state = resolveScoreState(
      ruleset,
      score,
      resolveElapsedMinutes(match, this.clock.now()),
    );
    return this.finish(
      tx,
      actor,
      await this.stream.advance(
        tx,
        match,
        score,
        sequence,
        state.capApplied,
        this.clock.now(),
      ),
      event,
    );
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    updated: Match,
    event: MatchEvent,
  ): Promise<MatchOperationResult> {
    await this.audit.record(
      tx,
      buildEventAudit(MATCH_SCORED_ACTION, actor.userId, updated, event),
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
