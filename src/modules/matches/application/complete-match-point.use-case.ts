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

import { hashCompletePointOperation } from '../lib/match-operation.hash';
import {
  buildPlayAudit,
  buildPointCompletedEvent,
  buildPointCompletedPlay,
} from '../lib/matches.builders';
import { toOptionalInstant } from '../lib/matches.helpers';
import { MATCH_POINT_COMPLETED_ACTION } from '../model/matches.constants';
import { OperationOutcome } from '../model/matches.enums';
import type {
  CompletePointCommand,
  Match,
  MatchPlayEvent,
  MatchPlayResult,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchPlayStreamService } from './match-play-stream.service';

/**
 * Closes the open point by recording which side scored it (match.score).
 *
 * Hold and break are never stored: they are DERIVED from this fact together with
 * the line the point started on, so the classification can never disagree with
 * the scoreboard. The point length stays NULL when it was not measured rather
 * than being written as a zero-second point.
 */
@Injectable()
export class CompleteMatchPointUseCase {
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
    command: CompletePointCommand,
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
    command: CompletePointCommand,
  ): Promise<MatchPlayResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashCompletePointOperation(command.content);
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
    command: CompletePointCommand,
    hash: string,
  ): Promise<MatchPlayResult> {
    this.stream.assertOpen(match);
    const open = this.stream.requireOpenPoint(
      await this.stream.findOpenPoint(tx, match.matchId),
    );
    const sequence = await this.stream.sequenceFor(tx, match.matchId);
    const play = await this.stream.append(
      tx,
      buildPointCompletedPlay(
        this.idGenerator.generate(),
        match,
        command.content,
        hash,
        sequence,
        open.pointNumber,
        toOptionalInstant(command.content.occurredAt),
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, match, play);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    play: MatchPlayEvent,
  ): Promise<MatchPlayResult> {
    await this.audit.record(
      tx,
      buildPlayAudit(MATCH_POINT_COMPLETED_ACTION, actor.userId, match, play),
    );
    await this.events.enqueue(
      tx,
      buildPointCompletedEvent(match, play, actor.userId),
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
