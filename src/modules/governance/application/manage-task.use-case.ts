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

import {
  canTransitionTask,
  taskTargetOf,
} from '../domain/governance.state-machine';
import { GovernanceInvalidTransitionError } from '../errors/governance-invalid-transition.error';
import { GovernanceVersionConflictError } from '../errors/governance-version-conflict.error';
import { TaskRepository } from '../infrastructure/task.repository';
import {
  buildNewTask,
  buildTaskAudit,
  buildTaskStatusChange,
} from '../lib/governance.builders';
import {
  TASK_CREATED_ACTION,
  TASK_TRANSITIONED_ACTION,
} from '../model/governance.constants';
import type {
  CreateTaskCommand,
  GovernanceTask,
  TaskTransitionCommand,
} from '../model/governance.types';
import { GovernanceLookupService } from './governance-lookup.service';

/**
 * Creates and moves governance tasks (UN-603). A task can be reassigned during a
 * transition (a new owner passed on the transition command), completed (which
 * stamps the completion instant), or reopened. All under an optimistic version
 * guard so two owners cannot both drive the same task.
 */
@Injectable()
export class ManageTaskUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: GovernanceLookupService,
    private readonly tasks: TaskRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  create(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateTaskCommand,
  ): Promise<GovernanceTask> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runCreate(tx, actor, teamId, command),
    );
  }

  transition(
    actor: AuthUserIdentity,
    teamId: string,
    taskId: string,
    command: TaskTransitionCommand,
  ): Promise<GovernanceTask> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runTransition(tx, actor, teamId, taskId, command),
    );
  }

  private async runCreate(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateTaskCommand,
  ): Promise<GovernanceTask> {
    await this.lookup.requireTeam(tx, teamId);
    await this.requireOwner(tx, teamId, command.content.ownerMembershipId);
    const task = await this.tasks.insert(
      tx,
      buildNewTask(
        this.ids.generate(),
        teamId,
        command.content,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.audit.record(
      tx,
      buildTaskAudit(TASK_CREATED_ACTION, actor.userId, task),
    );
    return task;
  }

  private async runTransition(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    taskId: string,
    command: TaskTransitionCommand,
  ): Promise<GovernanceTask> {
    const existing = await this.lookup.requireTask(tx, teamId, taskId);
    const target = taskTargetOf(command.transition);
    if (!canTransitionTask(existing.status, target)) {
      throw new GovernanceInvalidTransitionError();
    }
    await this.requireOwner(tx, teamId, command.ownerMembershipId);
    const changed = await this.tasks.applyStatusChange(
      tx,
      buildTaskStatusChange(
        existing,
        target,
        command.ownerMembershipId,
        command,
        this.clock.now(),
      ),
    );
    if (changed === null) {
      throw new GovernanceVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildTaskAudit(TASK_TRANSITIONED_ACTION, actor.userId, changed),
    );
    return changed;
  }

  private async requireOwner(
    tx: TransactionScope,
    teamId: string,
    ownerMembershipId: string | null,
  ): Promise<void> {
    if (ownerMembershipId !== null) {
      await this.lookup.requireMember(tx, teamId, ownerMembershipId);
    }
  }
}
