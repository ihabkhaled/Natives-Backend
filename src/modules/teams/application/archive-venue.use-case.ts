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

import { VenueNotFoundError } from '../errors/venue-not-found.error';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { VenueRepository } from '../infrastructure/venue.repository';
import { VENUE_ARCHIVED_EVENT } from '../model/teams.constants';
import type { NewAuditEvent, Venue } from '../model/teams.types';

/**
 * Archives a venue within its team scope. A venue from another team, an unknown
 * venue, or an already-archived venue resolves to not-found (404).
 */
@Injectable()
export class ArchiveVenueUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly venues: VenueRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    venueId: string,
  ): Promise<Venue> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, venueId),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    venueId: string,
  ): Promise<Venue> {
    const now = this.clock.now();
    const archived = await this.venues.archive(
      scope,
      teamId,
      venueId,
      actor.userId,
      now,
    );
    if (archived === null) {
      throw new VenueNotFoundError();
    }
    await this.audit.append(scope, this.buildAudit(actor, archived, now));
    return archived;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    venue: Venue,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: VENUE_ARCHIVED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: venue.teamId, venueId: venue.id },
      occurredAt: now,
    };
  }
}
