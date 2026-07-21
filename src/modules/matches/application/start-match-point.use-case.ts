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

import { canStartPoint } from '../domain/match-point.state-machine';
import { MatchPointAlreadyOpenError } from '../errors/match-point-already-open.error';
import { hashStartPointOperation } from '../lib/match-operation.hash';
import {
  buildPlayAudit,
  buildPointStartedEvent,
  buildPointStartedPlay,
} from '../lib/matches.builders';
import { toOptionalInstant } from '../lib/matches.helpers';
import { MATCH_POINT_STARTED_ACTION } from '../model/matches.constants';
import { OperationOutcome } from '../model/matches.enums';
import type {
  Match,
  MatchPlayEvent,
  MatchPlayResult,
  StartPointCommand,
} from '../model/matches.types';
import { MatchLineupService } from './match-lineup.service';
import { MatchLookupService } from './match-lookup.service';
import { MatchPlayStreamService } from './match-play-stream.service';

/**
 * Opens a point by recording the line that took the field (match.score).
 *
 * The lineup is a FACT on the append-only stream, not a mutable roster slice, so
 * "points played" is always re-derivable from it. The operation is idempotent on
 * the caller's operation id — a replayed start returns the stored point and its
 * stored line, and the same id with a different line is a conflict rather than a
 * silent rewrite. All effects commit in one transaction.
 */
@Injectable()
export class StartMatchPointUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly stream: MatchPlayStreamService,
    private readonly lineup: MatchLineupService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: StartPointCommand,
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
    command: StartPointCommand,
  ): Promise<MatchPlayResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashStartPointOperation(command.content);
    const replay = await this.stream.resolveReplay(
      tx,
      matchId,
      command.content.operationId,
      hash,
    );
    if (replay !== null) {
      return this.replayed(tx, replay);
    }
    return this.apply(tx, actor, match, command, hash);
  }

  private async apply(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: StartPointCommand,
    hash: string,
  ): Promise<MatchPlayResult> {
    this.stream.assertOpen(match);
    this.lineup.assertValid(command.content);
    const open = await this.stream.findOpenPoint(tx, match.matchId);
    if (!canStartPoint(open)) {
      throw new MatchPointAlreadyOpenError();
    }
    return this.append(tx, actor, match, command, hash);
  }

  private async append(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: StartPointCommand,
    hash: string,
  ): Promise<MatchPlayResult> {
    const pointNumber = await this.stream.nextPointNumberFor(tx, match.matchId);
    const sequence = await this.stream.sequenceFor(tx, match.matchId);
    const play = await this.stream.append(
      tx,
      buildPointStartedPlay(
        this.idGenerator.generate(),
        match,
        command.content,
        hash,
        sequence,
        pointNumber,
        toOptionalInstant(command.content.occurredAt),
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, match, play, command);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    play: MatchPlayEvent,
    command: StartPointCommand,
  ): Promise<MatchPlayResult> {
    const lineup = await this.lineup.record(
      tx,
      match,
      play,
      command.content,
      this.clock.now(),
    );
    await this.audit.record(
      tx,
      buildPlayAudit(MATCH_POINT_STARTED_ACTION, actor.userId, match, play),
    );
    await this.events.enqueue(
      tx,
      buildPointStartedEvent(match, play, lineup.length, actor.userId),
    );
    return {
      outcome: OperationOutcome.Applied,
      play,
      pointNumber: play.pointNumber,
      lineup,
    };
  }

  private async replayed(
    tx: TransactionScope,
    play: MatchPlayEvent,
  ): Promise<MatchPlayResult> {
    return {
      outcome: OperationOutcome.Replayed,
      play,
      pointNumber: play.pointNumber,
      lineup: await this.lineup.listForPlay(tx, play.playId),
    };
  }
}
