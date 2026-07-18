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
import { Inject, Injectable } from '@nestjs/common';

import { SlugConflictError } from '../errors/slug-conflict.error';
import { CatalogRepository } from '../infrastructure/catalog.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import {
  CATALOG_ENTRY_CREATED_EVENT,
  DEFAULT_SORT_ORDER,
  EMPTY_JSON_OBJECT,
} from '../model/teams.constants';
import type {
  CatalogEntry,
  CreateCatalogEntryCommand,
  NewAuditEvent,
  NewCatalogEntry,
} from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Adds an entry to a team reference catalog (division, gender format, position,
 * ...). Requires an active team and a key unique within the catalog. Entries are
 * archived, never deleted, preserving historical interpretability.
 */
@Injectable()
export class CreateCatalogEntryUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly catalog: CatalogRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCatalogEntryCommand,
  ): Promise<CatalogEntry> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateCatalogEntryCommand,
  ): Promise<CatalogEntry> {
    await this.teamLookup.requireActive(scope, teamId);
    if (
      await this.catalog.existsByKey(
        scope,
        teamId,
        command.catalog,
        command.key,
      )
    ) {
      throw new SlugConflictError();
    }
    const now = this.clock.now();
    const entry = await this.catalog.insert(
      scope,
      this.buildEntry(teamId, command, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, entry, now));
    return entry;
  }

  private buildEntry(
    teamId: string,
    command: CreateCatalogEntryCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewCatalogEntry {
    return {
      id: this.idGenerator.generate(),
      teamId,
      catalog: command.catalog,
      key: command.key,
      label: command.label,
      sortOrder: command.sortOrder ?? DEFAULT_SORT_ORDER,
      metadata: command.metadata ?? EMPTY_JSON_OBJECT,
      createdBy: actor.userId,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    entry: CatalogEntry,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: CATALOG_ENTRY_CREATED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: entry.teamId,
        catalog: entry.catalog,
        entryId: entry.id,
      },
      occurredAt: now,
    };
  }
}
