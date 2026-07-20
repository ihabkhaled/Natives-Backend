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

import { isFinalizable, isMatchFinalized } from '../domain/match.state-machine';
import {
  isAssertedScoreConflicting,
  resolveFinalizeAction,
  toAssertedScore,
  toCurrentScore,
} from '../domain/match-correction.policy';
import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchInvalidTransitionError } from '../errors/match-invalid-transition.error';
import { MatchOperationConflictError } from '../errors/match-operation-conflict.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import { MatchRepository } from '../infrastructure/match.repository';
import { MatchRevisionRepository } from '../infrastructure/match-revision.repository';
import {
  buildMatchAudit,
  buildMatchFinalization,
  buildMatchFinalizedEvent,
  buildNewMatchRevision,
} from '../lib/matches.builders';
import {
  MATCH_FINALIZE_REASON,
  MATCH_FINALIZED_ACTION,
} from '../model/matches.constants';
import type { FinalizeMatchCommand, Match } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Publishes the authoritative result of a completed match (match.finalize).
 *
 * The score is taken from the projection of the event stream, never from the
 * request: a caller MAY assert the score they believe is final, and a
 * disagreement is refused as an explicit conflict rather than merged — the
 * "never silently merge conflicting final scores" invariant. Finalizing appends
 * an immutable revision row and publishes `match.finalized`, after which the
 * database rejects every in-place edit of the record.
 */
@Injectable()
export class FinalizeMatchUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: MatchLookupService,
    private readonly matches: MatchRepository,
    private readonly revisions: MatchRevisionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: FinalizeMatchCommand,
  ): Promise<Match> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, matchId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: FinalizeMatchCommand,
  ): Promise<Match> {
    const existing = await this.lookup.require(tx, teamId, matchId);
    this.assertFinalizable(existing, command);
    const finalized = await this.matches.applyFinalization(
      tx,
      buildMatchFinalization(
        existing,
        command.expectedRecordVersion,
        actor.userId,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, existing, finalized);
  }

  private assertFinalizable(
    existing: Match,
    command: FinalizeMatchCommand,
  ): void {
    if (isMatchFinalized(existing.status)) {
      throw new MatchFinalizedError();
    }
    if (!isFinalizable(existing.status)) {
      throw new MatchInvalidTransitionError();
    }
    const asserted = toAssertedScore(command.ourScore, command.opponentScore);
    if (isAssertedScoreConflicting(toCurrentScore(existing), asserted)) {
      throw new MatchOperationConflictError();
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Match,
    finalized: Match | null,
  ): Promise<Match> {
    if (finalized === null) {
      throw new MatchVersionConflictError();
    }
    await this.record(tx, actor, existing, finalized);
    await this.audit.record(
      tx,
      buildMatchAudit(MATCH_FINALIZED_ACTION, actor.userId, finalized),
    );
    await this.events.enqueue(
      tx,
      buildMatchFinalizedEvent(finalized, actor.userId),
    );
    return finalized;
  }

  private async record(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Match,
    finalized: Match,
  ): Promise<void> {
    await this.revisions.append(
      tx,
      buildNewMatchRevision(
        this.idGenerator.generate(),
        await this.revisions.nextSequence(tx, finalized.matchId),
        finalized,
        resolveFinalizeAction(finalized.revision),
        MATCH_FINALIZE_REASON,
        existing.status,
        toCurrentScore(existing),
        actor.userId,
        this.clock.now(),
      ),
    );
  }
}
