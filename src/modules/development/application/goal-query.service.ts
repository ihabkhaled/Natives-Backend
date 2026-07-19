import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { DevelopmentGoalNotFoundError } from '../errors/development-goal-not-found.error';
import { DevelopmentGoalRepository } from '../infrastructure/development-goal.repository';
import type { PageRequest } from '../model/development.types';
import type {
  DevelopmentGoal,
  DevelopmentGoalDetail,
  DevelopmentGoalDetailPage,
  GoalAction,
} from '../model/goal.types';

/**
 * Read side of development goals. Every list is a single bounded, deterministically
 * ordered page in one transaction. Team reads (feedback.manage) see every goal in
 * the team; the member self read (feedback.read.self) returns ONLY the caller's
 * own goals resolved from the authenticated identity.
 */
@Injectable()
export class GoalQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: DevelopmentGoalRepository,
  ) {}

  listForTeam(
    teamId: string,
    page: PageRequest,
  ): Promise<DevelopmentGoalDetailPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.teamPage(tx, teamId, page),
    );
  }

  getDetail(teamId: string, goalId: string): Promise<DevelopmentGoalDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.detail(tx, teamId, goalId),
    );
  }

  listForMember(
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<DevelopmentGoalDetailPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.memberPage(tx, teamId, userId, page),
    );
  }

  private async teamPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<DevelopmentGoalDetailPage> {
    const goals = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return this.assemble(tx, goals, total, page);
  }

  private async memberPage(
    tx: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<DevelopmentGoalDetailPage> {
    const goals = await this.repository.listForMember(tx, teamId, userId, page);
    const total = await this.repository.countForMember(tx, teamId, userId);
    return this.assemble(tx, goals, total, page);
  }

  private async detail(
    tx: TransactionScope,
    teamId: string,
    goalId: string,
  ): Promise<DevelopmentGoalDetail> {
    const goal = await this.repository.findForWrite(tx, teamId, goalId);
    if (goal === null) {
      throw new DevelopmentGoalNotFoundError();
    }
    const actions = await this.repository.findActions(tx, goalId);
    return { goal, actions };
  }

  private async assemble(
    tx: TransactionScope,
    goals: readonly DevelopmentGoal[],
    total: number,
    page: PageRequest,
  ): Promise<DevelopmentGoalDetailPage> {
    const actions = await this.repository.actionsByGoal(
      tx,
      goals.map(goal => goal.id),
    );
    return {
      items: goals.map(goal => this.detailOf(goal, actions)),
      total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private detailOf(
    goal: DevelopmentGoal,
    actions: ReadonlyMap<string, readonly GoalAction[]>,
  ): DevelopmentGoalDetail {
    return { goal, actions: actions.get(goal.id) ?? [] };
  }
}
