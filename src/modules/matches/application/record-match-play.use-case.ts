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

import { isPossessionPlay } from '../domain/match-point.state-machine';
import { MatchValidationError } from '../errors/match-validation.error';
import { hashPlayOperation } from '../lib/match-operation.hash';
import {
  buildPlayAcceptedEvent,
  buildPlayAudit,
  buildPossessionPlay,
} from '../lib/matches.builders';
import { toOptionalInstant } from '../lib/matches.helpers';
import { MATCH_PLAY_RECORDED_ACTION } from '../model/matches.constants';
import { OperationOutcome } from '../model/matches.enums';
import type {
  Match,
  MatchPlayEvent,
  MatchPlayResult,
  RecordPlayCommand,
} from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';
import { MatchPlayStreamService } from './match-play-stream.service';
import { MatchScopeService } from './match-scope.service';

/**
 * Appends one possession fact — pull, throw, completion, goal, drop, throwaway,
 * block, stall, call, turnover, substitution, or a forced opponent error — to the
 * open point (match.score).
 *
 * Goals carry their assist EXPLICITLY: a recorded assister, a deliberate "there
 * was none" for a Callahan or unassisted goal, or `unknown` when it simply was
 * not captured. The three are never collapsed into each other.
 */
@Injectable()
export class RecordMatchPlayUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly stream: MatchPlayStreamService,
    private readonly scope: MatchScopeService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: RecordPlayCommand,
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
    command: RecordPlayCommand,
  ): Promise<MatchPlayResult> {
    const match = await this.lookup.require(tx, teamId, matchId);
    const hash = hashPlayOperation(command.content);
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
    command: RecordPlayCommand,
    hash: string,
  ): Promise<MatchPlayResult> {
    this.stream.assertOpen(match);
    if (!isPossessionPlay(command.content.playType)) {
      throw new MatchValidationError();
    }
    await this.assertParticipants(tx, match, command);
    return this.append(tx, actor, match, command, hash);
  }

  private async assertParticipants(
    tx: TransactionScope,
    match: Match,
    command: RecordPlayCommand,
  ): Promise<void> {
    await this.scope.requireMembership(
      tx,
      match.teamId,
      command.content.primaryMembershipId,
    );
    await this.scope.requireMembership(
      tx,
      match.teamId,
      command.content.secondaryMembershipId,
    );
  }

  private async append(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    match: Match,
    command: RecordPlayCommand,
    hash: string,
  ): Promise<MatchPlayResult> {
    const open = this.stream.requireOpenPoint(
      await this.stream.findOpenPoint(tx, match.matchId),
    );
    const sequence = await this.stream.sequenceFor(tx, match.matchId);
    const play = await this.stream.append(
      tx,
      buildPossessionPlay(
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
      buildPlayAudit(MATCH_PLAY_RECORDED_ACTION, actor.userId, match, play),
    );
    await this.events.enqueue(
      tx,
      buildPlayAcceptedEvent(match, play, actor.userId),
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
