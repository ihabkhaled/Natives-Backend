import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { DevelopmentGoalNotFoundError } from '../errors/development-goal-not-found.error';
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import type { DevelopmentGoal } from '../model/goal.types';

/**
 * Shared load-and-guard helper for development-goal write use-cases. A missing,
 * soft-deleted, or out-of-scope goal resolves to a 404 that hides existence.
 */
@Injectable()
export class GoalLookupService {
  constructor(private readonly repository: DevelopmentGoalRepository) {}

  async requireForWrite(
    scope: TransactionScope,
    teamId: string,
    goalId: string,
  ): Promise<DevelopmentGoal> {
    const goal = await this.repository.findForWrite(scope, teamId, goalId);
    if (goal === null) {
      throw new DevelopmentGoalNotFoundError();
    }
    return goal;
  }
}
