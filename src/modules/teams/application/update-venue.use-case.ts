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

import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SlugConflictError } from '../errors/slug-conflict.error';
import { VenueNotFoundError } from '../errors/venue-not-found.error';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { VenueRepository } from '../infrastructure/venue.repository';
import {
  DEFAULT_TIMEZONE,
  VENUE_UPDATED_EVENT,
} from '../model/teams.constants';
import type {
  NewAuditEvent,
  UpdateVenueCommand,
  Venue,
  VenueUpdate,
} from '../model/teams.types';

/**
 * Updates a venue under optimistic concurrency within its team scope. Missing or
 * cross-team venues resolve to not-found; a stale expected version raises a
 * version-conflict. Name uniqueness is re-checked only when the name changes.
 */
@Injectable()
export class UpdateVenueUseCase {
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
    command: UpdateVenueCommand,
  ): Promise<Venue> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, venueId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    venueId: string,
    command: UpdateVenueCommand,
  ): Promise<Venue> {
    const existing = await this.venues.findByIdInTeam(scope, teamId, venueId);
    if (existing === null) {
      throw new VenueNotFoundError();
    }
    if (existing.version !== command.expectedVersion) {
      throw new OptimisticConflictError();
    }
    if (
      existing.name.toLowerCase() !== command.name.toLowerCase() &&
      (await this.venues.existsByName(scope, teamId, command.name))
    ) {
      throw new SlugConflictError();
    }
    return this.applyUpdate(scope, actor, teamId, venueId, command);
  }

  private async applyUpdate(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    venueId: string,
    command: UpdateVenueCommand,
  ): Promise<Venue> {
    const now = this.clock.now();
    const updated = await this.venues.update(
      scope,
      this.buildUpdate(teamId, venueId, command, actor, now),
    );
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    await this.audit.append(scope, this.buildAudit(actor, updated, now));
    return updated;
  }

  private buildUpdate(
    teamId: string,
    venueId: string,
    command: UpdateVenueCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): VenueUpdate {
    return {
      id: venueId,
      teamId,
      name: command.name,
      address: command.address,
      timezone: command.timezone ?? DEFAULT_TIMEZONE,
      latitude: command.latitude,
      longitude: command.longitude,
      status: command.status,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now,
    };
  }

  private buildAudit(
    actor: AuthUserIdentity,
    venue: Venue,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: VENUE_UPDATED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: venue.teamId,
        venueId: venue.id,
        version: venue.version,
      },
      occurredAt: now,
    };
  }
}
