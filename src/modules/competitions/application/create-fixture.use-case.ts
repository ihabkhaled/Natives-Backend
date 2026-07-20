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
import {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { Inject, Injectable } from '@nestjs/common';

import { assertFixtureWithinWindow } from '../domain/fixture-scheduling.policy';
import { FixtureRepository } from '../infrastructure/fixture.repository';
import {
  buildFixtureAudit,
  buildFixtureScheduledEvent,
  buildNewFixture,
} from '../lib/competitions.builders';
import { toCairoDateOnly } from '../lib/competitions.helpers';
import { toFixtureView } from '../lib/competitions.mapper';
import { FIXTURE_CREATED_ACTION } from '../model/competitions.constants';
import type {
  Competition,
  CreateFixtureCommand,
  Fixture,
  FixtureView,
} from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';
import { CompetitionScopeService } from './competition-scope.service';
import { FixtureLinkageService } from './fixture-linkage.service';

/**
 * Books a fixture (a scheduled match versus a catalogued opponent) under a
 * competition. The competition, opponent, stage/round linkage, and venue are all
 * validated within the team scope, the UTC instant is checked to fall inside the
 * competition's Africa/Cairo date window, then the fixture, an audit entry, and a
 * `fixture.scheduled` event are written in one transaction.
 */
@Injectable()
export class CreateFixtureUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly lookup: CompetitionLookupService,
    private readonly scope: CompetitionScopeService,
    private readonly linkage: FixtureLinkageService,
    private readonly repository: FixtureRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: CreateFixtureCommand,
  ): Promise<FixtureView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, competitionId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    command: CreateFixtureCommand,
  ): Promise<FixtureView> {
    const competition = await this.lookup.require(tx, teamId, competitionId);
    await this.linkage.validate(tx, teamId, competitionId, command.content);
    await this.scope.requireVenue(tx, teamId, command.content.venueId);
    const scheduledAt = new Date(command.content.scheduledAt);
    assertFixtureWithinWindow(
      toCairoDateOnly(scheduledAt),
      competition.startsOn,
      competition.endsOn,
    );
    const fixture = await this.write(
      tx,
      actor,
      competition,
      scheduledAt,
      command,
    );
    return toFixtureView(fixture);
  }

  private async write(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    competition: Competition,
    scheduledAt: Date,
    command: CreateFixtureCommand,
  ): Promise<Fixture> {
    const fixture = await this.repository.insert(
      tx,
      buildNewFixture(
        this.idGenerator.generate(),
        competition.competitionId,
        competition.teamId,
        competition.seasonId,
        command.content,
        scheduledAt,
        actor.userId,
        this.clock.now(),
      ),
    );
    await this.finish(tx, actor, fixture);
    return fixture;
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    fixture: Fixture,
  ): Promise<void> {
    await this.audit.record(
      tx,
      buildFixtureAudit(FIXTURE_CREATED_ACTION, actor.userId, fixture),
    );
    await this.events.enqueue(
      tx,
      buildFixtureScheduledEvent(fixture, actor.userId),
    );
  }
}
