import type { AuthUserIdentity } from '@core/auth';
import { CLOCK_PORT, type ClockPort } from '@core/clock/clock.port';
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

import {
  canTransitionMatch,
  isAbandonTarget,
  isMatchFinalized,
  isStartTransition,
  resolveMatchTarget,
} from '../domain/match.state-machine';
import { MatchFinalizedError } from '../errors/match-finalized.error';
import { MatchInvalidTransitionError } from '../errors/match-invalid-transition.error';
import { MatchValidationError } from '../errors/match-validation.error';
import { MatchVersionConflictError } from '../errors/match-version-conflict.error';
import { MatchRepository } from '../infrastructure/match.repository';
import {
  buildMatchAudit,
  buildMatchStartedEvent,
  buildMatchStateChangedEvent,
  buildMatchStatusChange,
} from '../lib/matches.builders';
import { MATCH_TRANSITIONED_ACTION } from '../model/matches.constants';
import type { MatchStatus } from '../model/matches.enums';
import type { Match, TransitionMatchCommand } from '../model/matches.types';
import { MatchLookupService } from './match-lookup.service';

/**
 * Drives the plain match lifecycle under an optimistic version guard
 * (match.manage): ready, start, pause, resume, halftime, complete, abandon.
 *
 * A FINALIZED match is refused outright — publishing a result is the end of the
 * plain lifecycle, and correcting one goes through the separately-permissioned,
 * reason-carrying reopen. Starting play publishes `match.started`; every accepted
 * transition publishes `match.state_changed`. All effects commit in one
 * transaction.
 */
@Injectable()
export class TransitionMatchUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: MatchLookupService,
    private readonly matches: MatchRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    matchId: string,
    command: TransitionMatchCommand,
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
    command: TransitionMatchCommand,
  ): Promise<Match> {
    const existing = await this.lookup.require(tx, teamId, matchId);
    const target = resolveMatchTarget(command.transition);
    this.assertAllowed(existing, target, command);
    const changed = await this.matches.applyStatusChange(
      tx,
      buildMatchStatusChange(
        existing,
        target,
        command.expectedRecordVersion,
        command.reason,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, existing, changed, command);
  }

  private assertAllowed(
    existing: Match,
    target: MatchStatus,
    command: TransitionMatchCommand,
  ): void {
    if (isMatchFinalized(existing.status)) {
      throw new MatchFinalizedError();
    }
    if (!canTransitionMatch(existing.status, target)) {
      throw new MatchInvalidTransitionError();
    }
    if (isAbandonTarget(target) && command.reason === null) {
      throw new MatchValidationError();
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Match,
    changed: Match | null,
    command: TransitionMatchCommand,
  ): Promise<Match> {
    if (changed === null) {
      throw new MatchVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildMatchAudit(MATCH_TRANSITIONED_ACTION, actor.userId, changed),
    );
    await this.publish(tx, actor, existing, changed, command);
    return changed;
  }

  private async publish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    existing: Match,
    changed: Match,
    command: TransitionMatchCommand,
  ): Promise<void> {
    if (isStartTransition(command.transition)) {
      await this.events.enqueue(
        tx,
        buildMatchStartedEvent(changed, actor.userId),
      );
    }
    await this.events.enqueue(
      tx,
      buildMatchStateChangedEvent(changed, existing.status, actor.userId),
    );
  }
}
