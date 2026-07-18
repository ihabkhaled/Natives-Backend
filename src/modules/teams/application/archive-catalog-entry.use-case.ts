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

import { isCatalogEntryReferenced } from '../domain/catalog-entry.policy';
import { CatalogEntryInUseError } from '../errors/catalog-entry-in-use.error';
import { CatalogEntryNotFoundError } from '../errors/catalog-entry-not-found.error';
import { CatalogRepository } from '../infrastructure/catalog.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { CATALOG_ENTRY_ARCHIVED_EVENT } from '../model/teams.constants';
import type { CatalogEntry, NewAuditEvent } from '../model/teams.types';

/**
 * Archives a reference-catalog entry within its team scope. Deletion of a
 * referenced entry is blocked: an entry still referenced by downstream records
 * (reference_count > 0) raises a conflict instead of being archived.
 */
@Injectable()
export class ArchiveCatalogEntryUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly catalog: CatalogRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    entryId: string,
  ): Promise<CatalogEntry> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, entryId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    entryId: string,
  ): Promise<CatalogEntry> {
    const existing = await this.catalog.findByIdInTeam(scope, teamId, entryId);
    if (existing === null) {
      throw new CatalogEntryNotFoundError();
    }
    if (isCatalogEntryReferenced(existing.referenceCount)) {
      throw new CatalogEntryInUseError();
    }
    const now = this.clock.now();
    const archived = await this.catalog.archive(
      scope,
      teamId,
      entryId,
      actor.userId,
      now,
    );
    if (archived === null) {
      throw new CatalogEntryNotFoundError();
    }
    await this.audit.append(scope, this.buildAudit(actor, archived, now));
    return archived;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    entry: CatalogEntry,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: CATALOG_ENTRY_ARCHIVED_EVENT,
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
