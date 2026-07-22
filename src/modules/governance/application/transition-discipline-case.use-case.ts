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
  canTransitionDiscipline,
  disciplineTargetOf,
  isResolveTarget,
  isReviewTarget,
} from '../domain/governance.state-machine';
import { GovernanceInvalidTransitionError } from '../errors/governance-invalid-transition.error';
import { GovernanceVersionConflictError } from '../errors/governance-version-conflict.error';
import { SeparationOfDutiesError } from '../errors/separation-of-duties.error';
import { DisciplineRepository } from '../infrastructure/discipline.repository';
import {
  buildCaseAudit,
  buildCaseResolvedEvent,
  buildCaseStatusChange,
} from '../lib/governance.builders';
import { CASE_TRANSITIONED_ACTION } from '../model/governance.constants';
import type {
  DisciplineCase,
  DisciplineTransitionCommand,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Moves a discipline case through its fair process (UN-602). The state machine
 * decides what is legal and the optimistic record version decides who wins a
 * race. Separation of duties is enforced: the reviewer of a case can never be
 * the person who opened it. Resolution enqueues a classification-only event so a
 * notifier can announce closure without leaking the confidential outcome.
 */
@Injectable()
export class TransitionDisciplineCaseUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: GovernanceLookupService,
    private readonly discipline: DisciplineRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    caseId: string,
    command: DisciplineTransitionCommand,
  ): Promise<DisciplineCase> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, caseId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    caseId: string,
    command: DisciplineTransitionCommand,
  ): Promise<DisciplineCase> {
    const existing = await this.lookup.requireCase(tx, teamId, caseId);
    const target = disciplineTargetOf(command.transition);
    if (!canTransitionDiscipline(existing.status, target)) {
      throw new GovernanceInvalidTransitionError();
    }
    this.assertSeparationOfDuties(existing, target, actor);
    const changed = await this.discipline.applyStatusChange(
      tx,
      buildCaseStatusChange(
        existing,
        target,
        command.action ?? existing.action,
        actor.userId,
        command,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private assertSeparationOfDuties(
    existing: DisciplineCase,
    target: DisciplineCase['status'],
    actor: AuthUserIdentity,
  ): void {
    if (isReviewTarget(target) && existing.openedBy === actor.userId) {
      throw new SeparationOfDutiesError();
    }
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: DisciplineCase | null,
  ): Promise<DisciplineCase> {
    if (changed === null) {
      throw new GovernanceVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildCaseAudit(CASE_TRANSITIONED_ACTION, actor.userId, changed),
    );
    if (isResolveTarget(changed.status)) {
      await this.events.enqueue(
        tx,
        buildCaseResolvedEvent(changed, actor.userId),
      );
    }
    return changed;
  }
}
