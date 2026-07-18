import type { AuthUserIdentity } from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { computeParticipation } from '../domain/attendance-scoring.policy';
import { AttendanceMembershipNotFoundError } from '../errors/attendance-membership-not-found.error';
import { AttendanceNotMemberError } from '../errors/attendance-not-member.error';
import { AttendanceRuleMissingError } from '../errors/attendance-rule-missing.error';
import { AttendanceMembershipRepository } from '../infrastructure/attendance-membership.repository';
import { AttendanceRecordRepository } from '../infrastructure/attendance-record.repository';
import { AttendanceScoringRuleRepository } from '../infrastructure/attendance-scoring-rule.repository';
import { toParticipationView } from '../lib/attendance.mapper';
import { PARTICIPATION_SCAN_LIMIT } from '../model/attendance.constants';
import type {
  AttendanceScoringRule,
  MembershipRef,
  ParticipationView,
} from '../model/attendance.types';

/**
 * Read side for attendance SCORING INPUTS. It projects raw participation facts from
 * FINALIZED attendance against the cited default rule version — counts, an unrounded
 * rate, and a points contribution — never a stored editable total. "Not enough data"
 * is null (distinct from a measured zero). The versioned scoring ENGINE is module
 * 303; this only ever exposes reproducible inputs.
 */
@Injectable()
export class ParticipationQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly memberships: AttendanceMembershipRepository,
    private readonly records: AttendanceRecordRepository,
    private readonly rules: AttendanceScoringRuleRepository,
  ) {}

  getForMember(
    teamId: string,
    membershipId: string,
    seasonId: string | null,
  ): Promise<ParticipationView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolveForMember(scope, teamId, membershipId, seasonId),
    );
  }

  getOwn(
    teamId: string,
    actor: AuthUserIdentity,
    seasonId: string | null,
  ): Promise<ParticipationView> {
    return this.unitOfWork.runInTransaction(scope =>
      this.resolveOwn(scope, teamId, actor, seasonId),
    );
  }

  private async resolveForMember(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    seasonId: string | null,
  ): Promise<ParticipationView> {
    await this.requireMembership(scope, teamId, membershipId);
    return this.project(scope, teamId, membershipId, seasonId);
  }

  private async resolveOwn(
    scope: TransactionScope,
    teamId: string,
    actor: AuthUserIdentity,
    seasonId: string | null,
  ): Promise<ParticipationView> {
    const membership = await this.requireOwnMembership(
      scope,
      teamId,
      actor.userId,
    );
    return this.project(scope, teamId, membership.id, seasonId);
  }

  private async project(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    seasonId: string | null,
  ): Promise<ParticipationView> {
    const rule = await this.requireRule(scope);
    const facts = await this.records.participationFacts(
      scope,
      teamId,
      membershipId,
      seasonId,
      PARTICIPATION_SCAN_LIMIT,
    );
    return toParticipationView(
      membershipId,
      seasonId,
      computeParticipation(facts, rule),
    );
  }

  private async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    const membership = await this.memberships.findByIdInTeam(
      scope,
      teamId,
      membershipId,
    );
    if (membership === null) {
      throw new AttendanceMembershipNotFoundError();
    }
  }

  private async requireOwnMembership(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<MembershipRef> {
    const membership = await this.memberships.findActiveByUser(
      scope,
      teamId,
      userId,
    );
    if (membership === null) {
      throw new AttendanceNotMemberError();
    }
    return membership;
  }

  private async requireRule(
    scope: TransactionScope,
  ): Promise<AttendanceScoringRule> {
    const rule = await this.rules.findDefault(scope);
    if (rule === null) {
      throw new AttendanceRuleMissingError();
    }
    return rule;
  }
}
