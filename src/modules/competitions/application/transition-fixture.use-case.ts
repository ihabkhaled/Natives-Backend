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
  canTransitionFixture,
  isFixtureCancelTarget,
  resolveFixtureTarget,
} from '../domain/fixture.state-machine';
import { FixtureInvalidTransitionError } from '../errors/fixture-invalid-transition.error';
import { FixtureScheduleError } from '../errors/fixture-schedule.error';
import { FixtureVersionConflictError } from '../errors/fixture-version-conflict.error';
import { FixtureRepository } from '../infrastructure/fixture.repository';
import {
  buildFixtureAudit,
  buildFixtureCancelledEvent,
  buildFixtureStatusChange,
} from '../lib/competitions.builders';
import { toFixtureView } from '../lib/competitions.mapper';
import { FIXTURE_TRANSITIONED_ACTION } from '../model/competitions.constants';
import { FixtureStatus } from '../model/competitions.enums';
import type {
  Fixture,
  FixtureView,
  TransitionFixtureCommand,
} from '../model/competitions.types';
import { CompetitionLookupService } from './competition-lookup.service';
import { FixtureLookupService } from './fixture-lookup.service';

/**
 * Moves a fixture through its ready → live → final / abandoned / cancelled
 * lifecycle under an optimistic version guard. Cancelling requires a reason,
 * stamps it, and keeps the fixture for history (never deletes it); cancellation
 * enqueues `fixture.cancelled`. All effects commit in one transaction.
 */
@Injectable()
export class TransitionFixtureUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    private readonly lookup: CompetitionLookupService,
    private readonly fixtures: FixtureLookupService,
    private readonly repository: FixtureRepository,
    private readonly audit: AuditRecorderService,
    private readonly events: RecordDomainEventService,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    competitionId: string,
    fixtureId: string,
    command: TransitionFixtureCommand,
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
    command: TransitionFixtureCommand,
  ): Promise<FixtureView> {
    await this.lookup.require(tx, teamId, competitionId);
    const fixture = await this.fixtures.require(
      tx,
      teamId,
      competitionId,
      fixtureId,
    );
    const target = resolveFixtureTarget(command.transition);
    this.assertTransition(fixture.status, target, command.reason);
    const changed = await this.repository.applyStatusChange(
      tx,
      buildFixtureStatusChange(
        fixture,
        teamId,
        target,
        command.reason,
        command.expectedRecordVersion,
        this.clock.now(),
      ),
    );
    return this.finish(tx, actor, changed);
  }

  private assertTransition(
    from: FixtureStatus,
    target: FixtureStatus,
    reason: string | null,
  ): void {
    if (!canTransitionFixture(from, target)) {
      throw new FixtureInvalidTransitionError();
    }
    if (isFixtureCancelTarget(target) && reason === null) {
      throw new FixtureScheduleError();
    }
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
      buildFixtureAudit(FIXTURE_TRANSITIONED_ACTION, actor.userId, changed),
    );
    if (changed.status === FixtureStatus.Cancelled) {
      await this.events.enqueue(
        tx,
        buildFixtureCancelledEvent(changed, actor.userId),
      );
    }
    return toFixtureView(changed);
  }
}
