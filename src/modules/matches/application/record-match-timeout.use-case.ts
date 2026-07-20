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

import { canCallTimeout } from '../domain/match-timeout.policy';
import { MatchTimeoutsExhaustedError } from '../errors/match-timeouts-exhausted.error';
import { MatchEventRepository } from '../infrastructure/match-event.repository';
import { hashTimeoutOperation } from '../lib/match-operation.hash';
import {
  buildEventAudit,
  buildTimeoutEvent,
  toScore,
} from '../lib/matches.builders';
import { toOptionalInstant } from '../lib/matches.helpers';
import { MATCH_TIMEOUT_ACTION } from '../model/matches.constants';
import { OperationOutcome } from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  MatchOperationResult,
  RecordTimeoutCommand,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchStreamService } from './match-stream.service';

/**
 * Records a timeout on the authoritative stream (match.score). The allowance is
 * read from the match's VERSIONED ruleset and the usage is COUNTED off the
 * stream — never a stored counter that could drift — so a side that has spent its
 * budget is refused with a typed 409 rather than silently allowed.
 *
 * Like a point, the operation is idempotent on the caller's operation id: the
 * same id replays to the same fact, and a differing payload is a conflict. A
 * timeout never changes the score. All effects commit in one transaction.
 */
@Injectable()
export class RecordMatchTimeoutUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly stream: MatchStreamService,
    private readonly events: MatchEventRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: RecordTimeoutCommand,
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
    command: RecordTimeoutCommand,
  ): Promise<MatchOperationResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashTimeoutOperation(command.content);
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
    command: RecordTimeoutCommand,
    hash: string,
  ): Promise<MatchOperationResult> {
    this.stream.assertOpen(match);
    await this.assertBudget(tx, match, command);
    return this.append(tx, actor, match, command, hash);
  }

  private async assertBudget(
    tx: TransactionScope,
    match: Match,
    command: RecordTimeoutCommand,
  ): Promise<void> {
    const ruleset = await this.lookup.requireRuleset(
      tx,
      match.teamId,
      match.rulesetId,
    );
    const usage = await this.events.countTimeouts(
      tx,
      match.matchId,
      match.period,
    );
    if (!canCallTimeout(ruleset, usage, command.content.scoringSide)) {
      throw new MatchTimeoutsExhaustedError();
    }
  }

  private async append(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: RecordTimeoutCommand,
    hash: string,
  ): Promise<MatchOperationResult> {
    const sequence = this.stream.sequenceFor(match);
    const event = await this.stream.append(
      tx,
      buildTimeoutEvent(
        this.idGenerator.generate(),
        match,
        command.content,
        hash,
        sequence,
        toOptionalInstant(command.content.occurredAt),
        actor.userId,
        this.clock.now(),
      ),
    );
    const updated = await this.stream.advance(
      tx,
      match,
      toScore(match),
      sequence,
      match.capApplied,
      this.clock.now(),
    );
    return this.finish(tx, actor, updated, event);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    updated: Match,
    event: MatchEvent,
  ): Promise<MatchOperationResult> {
    await this.audit.record(
      tx,
      buildEventAudit(MATCH_TIMEOUT_ACTION, actor.userId, updated, event),
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
