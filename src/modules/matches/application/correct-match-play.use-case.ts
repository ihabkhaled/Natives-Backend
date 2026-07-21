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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { hashCorrectionOperation } from '../lib/match-operation.hash';
import {
  buildCorrectionPlay,
  buildPlayAudit,
  buildPlayCorrectedEvent,
} from '../lib/matches.builders';
import { MATCH_PLAY_CORRECTED_ACTION } from '../model/matches.constants';
import { OperationOutcome } from '../model/matches.enums';
import type {
  CorrectPlayCommand,
  Match,
  MatchPlayEvent,
  MatchPlayResult,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchPlayStreamService } from './match-play-stream.service';

/**
 * Retracts a recorded fact by APPENDING a compensating correction (match.score).
 *
 * The original row is never rewritten or deleted — the database refuses that — so
 * the stream stays a complete, replayable history and the statistics stay a
 * projection of it. Because the derivation folds only the facts nothing
 * retracted, a stream that recorded a mistake and corrected it produces exactly
 * the statistics a clean stream would have produced.
 *
 * Correcting is itself idempotent on the operation id, and a fact a previous
 * correction already retracted cannot be retracted twice.
 */
@Injectable()
export class CorrectMatchPlayUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly stream: MatchPlayStreamService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: CorrectPlayCommand,
  ): Promise<MatchPlayResult> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, matchId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: CorrectPlayCommand,
  ): Promise<MatchPlayResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashCorrectionOperation(command.content);
    const replay = await this.stream.resolveReplay(
      tx,
      matchId,
      command.content.operationId,
      hash,
    );
    if (replay !== null) {
      return this.replayed(replay);
    }
    return this.apply(tx, actor, match, command, hash);
  }

  private async apply(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: CorrectPlayCommand,
    hash: string,
  ): Promise<MatchPlayResult> {
    this.stream.assertOpen(match);
    const target = await this.stream.requirePlay(
      tx,
      match.matchId,
      command.content.playId,
    );
    const sequence = await this.stream.sequenceFor(tx, match.matchId);
    const play = await this.stream.append(
      tx,
      buildCorrectionPlay(
        this.idGenerator.generate(),
        match,
        command.content,
        hash,
        sequence,
        target,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, match, play, target);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    play: MatchPlayEvent,
    target: MatchPlayEvent,
  ): Promise<MatchPlayResult> {
    await this.audit.record(
      tx,
      buildPlayAudit(MATCH_PLAY_CORRECTED_ACTION, actor.userId, match, play),
    );
    await this.events.enqueue(
      tx,
      buildPlayCorrectedEvent(match, play, target.playType, actor.userId),
    );
    return {
      outcome: OperationOutcome.Applied,
      play,
      pointNumber: play.pointNumber,
      lineup: [],
    };
  }

  private replayed(play: MatchPlayEvent): MatchPlayResult {
    return {
      outcome: OperationOutcome.Replayed,
      play,
      pointNumber: play.pointNumber,
      lineup: [],
    };
  }
}
