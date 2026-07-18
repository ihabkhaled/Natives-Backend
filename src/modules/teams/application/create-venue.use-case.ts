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
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { VenueRepository } from '../infrastructure/venue.repository';
import {
  DEFAULT_TIMEZONE,
  VENUE_CREATED_EVENT,
} from '../model/teams.constants';
import type {
  CreateVenueCommand,
  NewAuditEvent,
  NewVenue,
  Venue,
} from '../model/teams.types';
import { TeamLookupService } from './team-lookup.service';

/**
 * Creates a venue within a team. Requires an active team and a name unique within
 * the team. Coordinates are optional and stay null when absent (null-not-zero).
 */
@Injectable()
export class CreateVenueUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly teamLookup: TeamLookupService,
    private readonly venues: VenueRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateVenueCommand,
  ): Promise<Venue> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    command: CreateVenueCommand,
  ): Promise<Venue> {
    await this.teamLookup.requireActive(scope, teamId);
    if (await this.venues.existsByName(scope, teamId, command.name)) {
      throw new SlugConflictError();
    }
    const now = this.clock.now();
    const venue = await this.venues.insert(
      scope,
      this.buildVenue(teamId, command, actor, now),
    );
    await this.audit.append(scope, this.buildAudit(actor, venue, now));
    return venue;
  }

  private buildVenue(
    teamId: string,
    command: CreateVenueCommand,
    actor: AuthUserIdentity,
    now: Date,
  ): NewVenue {
    return {
      id: this.idGenerator.generate(),
      teamId,
      name: command.name,
      address: command.address,
      timezone: command.timezone ?? DEFAULT_TIMEZONE,
      latitude: command.latitude,
      longitude: command.longitude,
      createdBy: actor.userId,
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
      eventType: VENUE_CREATED_EVENT,
      actorUserId: actor.userId,
      context: { teamId: venue.teamId, venueId: venue.id },
      occurredAt: now,
    };
  }
}
