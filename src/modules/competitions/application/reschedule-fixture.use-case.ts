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

import { canReschedule } from '../domain/fixture.state-machine';
import {
  assertFixtureWithinWindow,
  assertRescheduleMovesFixture,
} from '../domain/fixture-scheduling.policy';
import { FixtureInvalidTransitionError } from '../errors/fixture-invalid-transition.error';
import { FixtureVersionConflictError } from '../errors/fixture-version-conflict.error';
import { FixtureRepository } from '../infrastructure/fixture.repository';
import {
  buildFixtureAudit,
  buildFixtureReschedule,
  buildFixtureRescheduledEvent,
} from '../lib/competitions.builders';
import { toCairoDateOnly } from '../lib/competitions.helpers';
import { toFixtureView } from '../lib/competitions.mapper';
import { FIXTURE_RESCHEDULED_ACTION } from '../model/competitions.constants';
import type {
  Fixture,
  FixtureView,
  RescheduleFixtureCommand,
} from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';
import { CompetitionScopeService } from './competition-scope.service';
import { FixtureLookupService } from './fixture-lookup.service';

/**
 * Reschedules a fixture to a new UTC instant before play begins. The fixture must
 * be reschedulable, the venue valid, the new instant genuinely different and still
 * inside the competition's Africa/Cairo window. The move is applied under an
 * optimistic version guard, audited, and published as `fixture.rescheduled` in one
 * transaction. The previous instant is retained on the row.
 */
@Injectable()
export class RescheduleFixtureUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: CompetitionLookupService,
    private readonly scope: CompetitionScopeService,
    private readonly repository: FixtureRepository,
    private readonly fixtures: FixtureLookupService,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    fixtureId: string,
    command: RescheduleFixtureCommand,
  ): Promise<FixtureView> {
    return this.unitOfWork.runInTransaction(tx =>
      this.run(tx, actor, teamId, competitionId, fixtureId, command),
    );
  }

  private async run(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    fixtureId: string,
    command: RescheduleFixtureCommand,
  ): Promise<FixtureView> {
    const competition = await this.lookup.require(tx, teamId, competitionId);
    const fixture = await this.fixtures.require(
      tx,
      teamId,
      competitionId,
      fixtureId,
    );
    const newScheduledAt = new Date(command.scheduledAt);
    this.assertReschedulable(
      fixture,
      newScheduledAt,
      competition.startsOn,
      competition.endsOn,
    );
    await this.scope.requireVenue(tx, teamId, command.venueId);
    return this.apply(tx, actor, teamId, fixture, newScheduledAt, command);
  }

  private assertReschedulable(
    fixture: Fixture,
    newScheduledAt: Date,
    startsOn: string | null,
    endsOn: string | null,
  ): void {
    if (!canReschedule(fixture.status)) {
      throw new FixtureInvalidTransitionError();
    }
    assertRescheduleMovesFixture(
      fixture.scheduledAt.getTime(),
      newScheduledAt.getTime(),
    );
    assertFixtureWithinWindow(
      toCairoDateOnly(newScheduledAt),
      startsOn,
      endsOn,
    );
  }

  private async apply(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    fixture: Fixture,
    newScheduledAt: Date,
    command: RescheduleFixtureCommand,
  ): Promise<FixtureView> {
    const changed = await this.repository.applyReschedule(
      tx,
      buildFixtureReschedule(
        fixture,
        teamId,
        newScheduledAt,
        command.venueId,
        command.reason,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private async finish(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    changed: Fixture | null,
  ): Promise<FixtureView> {
    if (changed === null) {
      throw new FixtureVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildFixtureAudit(FIXTURE_RESCHEDULED_ACTION, actor.userId, changed),
    );
    await this.events.enqueue(
      tx,
      buildFixtureRescheduledEvent(changed, actor.userId),
    );
    return toFixtureView(changed);
  }
}
