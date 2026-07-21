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

import {
  canTransitionSeason,
  claimsCurrentSeasonSlot,
} from '../domain/season-lifecycle.state-machine';
import { OptimisticConflictError } from '../errors/optimistic-conflict.error';
import { SeasonAlreadyActiveError } from '../errors/season-already-active.error';
import { SeasonInvalidTransitionError } from '../errors/season-invalid-transition.error';
import { SeasonNotFoundError } from '../errors/season-not-found.error';
import { SeasonRepository } from '../infrastructure/season.repository';
import { TeamAuditRepository } from '../infrastructure/team-audit.repository';
import { SEASON_TRANSITIONED_EVENT } from '../model/teams.constants';
import type { SeasonStatus } from '../model/teams.enums';
import type {
  NewAuditEvent,
  Season,
  SeasonStatusChange,
  TransitionCommand,
} from '../model/teams.types';

/**
 * Applies a lifecycle transition (activate / close / archive / revive) to a
 * season: validates the move against the pure state machine, refuses to create a
 * second current season for the team, writes under optimistic concurrency, and
 * audits — all in one transaction. Nothing is deleted; a season only changes
 * state, so every attendance, points and match record stays attached.
 */
@Injectable()
export class TransitionSeasonUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
    private readonly seasons: SeasonRepository,
    private readonly audit: TeamAuditRepository,
  ) {}

  execute(
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
    target: SeasonStatus,
    command: TransitionCommand,
  ): Promise<Season> {
    return this.unitOfWork.runInTransaction(scope =>
      this.run(scope, actor, teamId, seasonId, target, command),
    );
  }

  private async run(
    scope: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    seasonId: string,
    target: SeasonStatus,
    command: TransitionCommand,
  ): Promise<Season> {
    const current = await this.seasons.findByIdInTeam(scope, teamId, seasonId);
    if (current === null) {
      throw new SeasonNotFoundError();
    }
    if (!canTransitionSeason(current.status, target)) {
      throw new SeasonInvalidTransitionError();
    }
    await this.guardCurrentSlot(scope, teamId, seasonId, target);
    const now = this.clock.now();
    const updated = await this.apply(
      scope,
      this.buildChange(teamId, seasonId, target, actor, command, now),
    );
    await this.audit.append(
      scope,
      this.buildAudit(actor, current.status, updated, now),
    );
    return updated;
  }

  private async guardCurrentSlot(
    scope: TransactionScope,
    teamId: string,
    seasonId: string,
    target: SeasonStatus,
  ): Promise<void> {
    if (!claimsCurrentSeasonSlot(target)) {
      return;
    }
    if (await this.seasons.hasOtherActive(scope, teamId, seasonId)) {
      throw new SeasonAlreadyActiveError();
    }
  }

  private buildChange(
    teamId: string,
    seasonId: string,
    target: SeasonStatus,
    actor: AuthUserIdentity,
    command: TransitionCommand,
    now: Date,
  ): SeasonStatusChange {
    return {
      id: seasonId,
      teamId,
      status: target,
      updatedBy: actor.userId,
      expectedVersion: command.expectedVersion,
      now,
    };
  }

  private async apply(
    scope: TransactionScope,
    change: SeasonStatusChange,
  ): Promise<Season> {
    const updated = await this.seasons.applyStatusChange(scope, change);
    if (updated === null) {
      throw new OptimisticConflictError();
    }
    return updated;
  }

  private buildAudit(
    actor: AuthUserIdentity,
    from: SeasonStatus,
    season: Season,
    now: Date,
  ): NewAuditEvent {
    return {
      id: this.idGenerator.generate(),
      eventType: SEASON_TRANSITIONED_EVENT,
      actorUserId: actor.userId,
      context: {
        teamId: season.teamId,
        seasonId: season.id,
        from,
        to: season.status,
      },
      occurredAt: now,
    };
  }
}
