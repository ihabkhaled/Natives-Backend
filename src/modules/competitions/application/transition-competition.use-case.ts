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
  canTransitionCompetition,
  isCancelTarget,
  isPublishTarget,
  resolveCompetitionTarget,
} from '../domain/competition.state-machine';
import { CompetitionInvalidTransitionError } from '../errors/competition-invalid-transition.error';
import { CompetitionValidationError } from '../errors/competition-validation.error';
import { CompetitionVersionConflictError } from '../errors/competition-version-conflict.error';
import { CompetitionRepository } from '../infrastructure/competition.repository';
import {
  buildCompetitionAudit,
  buildCompetitionCancelledEvent,
  buildCompetitionPublishedEvent,
  buildCompetitionStatusChange,
} from '../lib/competitions.builders';
import { COMPETITION_TRANSITIONED_ACTION } from '../model/competitions.constants';
import { CompetitionStatus } from '../model/competitions.enums';
import type {
  Competition,
  TransitionCompetitionCommand,
} from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';

/**
 * Moves a competition through its DRAFT → PUBLISHED → ACTIVE → COMPLETED /
 * CANCELLED → ARCHIVED lifecycle under an optimistic version guard. Publishing
 * enqueues `competition.published`; cancelling requires a reason, stamps it, keeps
 * every historical stage/round/fixture, and enqueues `competition.cancelled`. All
 * effects commit in one transaction.
 */
@Injectable()
export class TransitionCompetitionUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: CompetitionLookupService,
    private readonly repository: CompetitionRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: TransitionCompetitionCommand,
  ): Promise<Competition> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, competitionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: TransitionCompetitionCommand,
  ): Promise<Competition> {
    const existing = await this.lookup.require(tx, teamId, competitionId);
    const target = resolveCompetitionTarget(command.transition);
    this.assertTransition(existing.status, target, command.reason);
    const changed = await this.repository.applyStatusChange(
      tx,
      buildCompetitionStatusChange(
        existing,
        teamId,
        target,
        actor.userId,
        command.reason,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private assertTransition(
    from: CompetitionStatus,
    target: CompetitionStatus,
    reason: string | null,
  ): void {
    if (!canTransitionCompetition(from, target)) {
      throw new CompetitionInvalidTransitionError();
    }
    if (isCancelTarget(target) && reason === null) {
      throw new CompetitionValidationError();
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: Competition | null,
  ): Promise<Competition> {
    if (changed === null) {
      throw new CompetitionVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildCompetitionAudit(
        COMPETITION_TRANSITIONED_ACTION,
        actor.userId,
        changed,
      ),
    );
    await this.dispatch(tx, actor, changed);
    return changed;
  }

  private async dispatch(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    competition: Competition,
  ): Promise<void> {
    if (isPublishTarget(competition.status)) {
      await this.events.enqueue(
        tx,
        buildCompetitionPublishedEvent(competition, actor.userId),
      );
      return;
    }
    if (competition.status === CompetitionStatus.Cancelled) {
      await this.events.enqueue(
        tx,
        buildCompetitionCancelledEvent(competition, actor.userId),
      );
    }
  }
}
