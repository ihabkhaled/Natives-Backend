import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { AssessmentScopeNotFoundError } from '../errors/assessment-scope-not-found.error';
import { AssessmentScopeRepository } from '../infrastructure/assessment-scope.repository';

@Injectable()
export class AssessmentScopeService {
  constructor(private readonly repository: AssessmentScopeRepository) {}

  async validate(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
  ): Promise<void> {
    if (!(await this.repository.activeTeamExists(scope, teamId))) {
      throw new AssessmentScopeNotFoundError();
    }
    if (
      seasonId !== null &&
      !(await this.repository.seasonExistsInTeam(scope, teamId, seasonId))
    ) {
      throw new AssessmentScopeNotFoundError();
    }
  }

  async requireMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    if (
      !(await this.repository.membershipExistsInTeam(
        scope,
        teamId,
        membershipId,
      ))
    ) {
      throw new AssessmentScopeNotFoundError();
    }
  }
}
