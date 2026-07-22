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

import { isCollision } from '../domain/alias-matching.policy';
import { AliasCollisionError } from '../errors/alias-collision.error';
import { MigrationVersionConflictError } from '../errors/migration-version-conflict.error';
import { AliasResolutionRepository } from '../infrastructure/alias-resolution.repository';
import {
  buildAliasAudit,
  buildNewAliasResolution,
} from '../lib/migration.builders';
import {
  ALIAS_REVIEWED_ACTION,
  AUTO_CONFIRM_CONFIDENCE,
} from '../model/migration.constants';
import { AliasResolutionStatus } from '../model/migration.enums';
import type {
  AliasResolution,
  RegisterAliasCommand,
  ReviewAliasCommand,
} from '../model/migration.types';
import { MigrationLookupService } from './migration-lookup.service';

/**
 * Registers legacy aliases and applies human review (UN-703).
 *
 * A candidate is proposed with a confidence, but only a HUMAN confirms an
 * ambiguous one. Confirming an alias to a membership that another confirmed
 * resolution already maps is a COLLISION — refused unless an explicit override
 * acknowledges it — so one alias never silently maps two distinct people. The
 * private source spelling is preserved; the diff and audit carry classifications
 * only.
 */
@Injectable()
export class ResolveAliasUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR_PORT) private readonly ids: IdGeneratorPort,
    private readonly lookup: MigrationLookupService,
    private readonly aliases: AliasResolutionRepository,
    private readonly audit: AuditRecorderService,
  ) {}

  register(
    _actor: AuthUserIdentity,
    teamId: string,
    command: RegisterAliasCommand,
  ): Promise<AliasResolution> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runRegister(tx, teamId, command),
    );
  }

  review(
    actor: AuthUserIdentity,
    teamId: string,
    resolutionId: string,
    command: ReviewAliasCommand,
  ): Promise<AliasResolution> {
    return this.unitOfWork.runInTransaction(tx =>
      this.runReview(tx, actor, teamId, resolutionId, command),
    );
  }

  private async runRegister(
    tx: TransactionScope,
    teamId: string,
    command: RegisterAliasCommand,
  ): Promise<AliasResolution> {
    await this.lookup.requireTeam(tx, teamId);
    await this.requireCandidate(tx, teamId, command.candidateMembershipId);
    const confidence =
      command.candidateMembershipId === null ? 0 : AUTO_CONFIRM_CONFIDENCE;
    return this.aliases.upsert(
      tx,
      buildNewAliasResolution(
        this.ids.generate(),
        teamId,
        command,
        confidence,
        this.clock.now(),
      ),
    );
  }

  private async runReview(
    tx: TransactionScope,
    actor: AuthUserIdentity,
    teamId: string,
    resolutionId: string,
    command: ReviewAliasCommand,
  ): Promise<AliasResolution> {
    const existing = await this.lookup.requireAlias(tx, teamId, resolutionId);
    await this.requireCandidate(tx, teamId, command.resolvedMembershipId);
    this.assertNoCollision(existing, command);
    const reviewed = await this.aliases.applyReview(tx, {
      id: existing.resolutionId,
      teamId,
      expectedRecordVersion: command.expectedRecordVersion,
      status: command.status,
      resolvedMembershipId: command.resolvedMembershipId,
      override: command.override,
      reviewedBy: actor.userId,
      now: this.clock.now(),
    });
    if (reviewed === null) {
      throw new MigrationVersionConflictError();
    }
    await this.audit.record(
      tx,
      buildAliasAudit(ALIAS_REVIEWED_ACTION, actor.userId, reviewed),
    );
    return reviewed;
  }

  /**
   * A confirmed alias already bound to one player cannot be re-bound to a
   * different player without an explicit override — that is the silent
   * double-map the invariant forbids.
   */
  private assertNoCollision(
    existing: AliasResolution,
    command: ReviewAliasCommand,
  ): void {
    if (
      command.status !== AliasResolutionStatus.Confirmed ||
      command.resolvedMembershipId === null
    ) {
      return;
    }
    if (
      isCollision(
        command.resolvedMembershipId,
        existing.resolvedMembershipId,
        command.override,
      )
    ) {
      throw new AliasCollisionError();
    }
  }

  private async requireCandidate(
    tx: TransactionScope,
    teamId: string,
    membershipId: string | null,
  ): Promise<void> {
    if (membershipId !== null) {
      await this.lookup.requireMember(tx, teamId, membershipId);
    }
  }
}
