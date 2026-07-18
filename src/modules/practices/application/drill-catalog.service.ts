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

import { DrillNameConflictError } from '../errors/drill-name-conflict.error';
import { DrillNotFoundError } from '../errors/drill-not-found.error';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { DrillRepository } from '../infrastructure/drill.repository';
import {
  buildDrillAudit,
  buildDrillUpdate,
  buildNewDrill,
} from '../lib/agendas.builders';
import { toDrillView } from '../lib/agendas.mapper';
import {
  DRILL_ARCHIVED_ACTION,
  DRILL_CREATED_ACTION,
  DRILL_UPDATED_ACTION,
} from '../model/agendas.constants';
import type {
  CreateDrillCommand,
  Drill,
  DrillView,
  NewDrill,
  UpdateDrillCommand,
} from '../model/agendas.types';
import { ScopeValidationService } from './scope-validation.service';

/**
 * Authoring for the reusable drill catalog (drill.manage). Each write runs in one
 * transaction that validates the team/season scope, applies the change under a
 * clean name-conflict + optimistic-version guard, and appends an audit row.
 * Archiving is idempotent and never deletes, so referencing blocks keep a stable
 * historical link.
 */
@Injectable()
export class DrillCatalogService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly scopeValidation: ScopeValidationService,
    private readonly drills: DrillRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  createDrill(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateDrillCommand,
  ): Promise<DrillView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runCreate(scope, actor, teamId, command),
    );
  }

  updateDrill(
    actor: AuthUserIdentity,
    teamId: string,
    drillId: string,
    command: UpdateDrillCommand,
  ): Promise<DrillView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runUpdate(scope, actor, teamId, drillId, command),
    );
  }

  archiveDrill(
    actor: AuthUserIdentity,
    teamId: string,
    drillId: string,
  ): Promise<DrillView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.runArchive(scope, actor, teamId, drillId),
    );
  }

  private async runCreate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateDrillCommand,
  ): Promise<DrillView> {
    await this.scopeValidation.validate(scope, teamId, command.seasonId, null);
    const drill = await this.drills.insert(
      scope,
      this.newRow(teamId, command, actor),
    );
    if (drill === null) {
      throw new DrillNameConflictError();
    }
    await this.recordAudit(scope, actor, drill, DRILL_CREATED_ACTION);
    return toDrillView(drill);
  }

  private newRow(
    teamId: string,
    command: CreateDrillCommand,
    actor: AuthUserIdentity,
  ): NewDrill {
    return buildNewDrill(
      this.idGenerator.generate(),
      teamId,
      command,
      actor.userId,
      this.clock.now(),
    );
  }

  private async runUpdate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    drillId: string,
    command: UpdateDrillCommand,
  ): Promise<DrillView> {
    await this.requireDrill(scope, teamId, drillId);
    await this.assertNameFree(scope, teamId, drillId, command.name);
    const updated = await this.drills.update(
      scope,
      buildDrillUpdate(drillId, command, actor.userId, this.clock.now()),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.recordAudit(scope, actor, updated, DRILL_UPDATED_ACTION);
    return toDrillView(updated);
  }

  private async runArchive(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    drillId: string,
  ): Promise<DrillView> {
    const existing = await this.requireDrill(scope, teamId, drillId);
    const archived = await this.drills.archive(
      scope,
      teamId,
      drillId,
      actor.userId,
      this.clock.now(),
    );
    const result = archived ?? existing;
    await this.recordAudit(scope, actor, result, DRILL_ARCHIVED_ACTION);
    return toDrillView(result);
  }

  private recordAudit(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    drill: Drill,
    action: string,
  ): Promise<void> {
    return this.audit.record(
      scope,
      buildDrillAudit(action, drill, actor.userId),
    );
  }

  private async assertNameFree(
    scope: TransactionScope,
    teamId: string,
    drillId: string,
    name: string,
  ): Promise<void> {
    if (await this.drills.activeNameExists(scope, teamId, name, drillId)) {
      throw new DrillNameConflictError();
    }
  }

  private async requireDrill(
    scope: TransactionScope,
    teamId: string,
    drillId: string,
  ): Promise<Drill> {
    const drill = await this.drills.findByIdInTeam(scope, teamId, drillId);
    if (drill === null) {
      throw new DrillNotFoundError();
    }
    return drill;
  }
}
