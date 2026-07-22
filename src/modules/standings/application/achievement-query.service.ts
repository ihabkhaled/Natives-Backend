import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { isTeamVisible } from '../domain/achievement.state-machine';
import { AchievementNotFoundError } from '../errors/achievement-not-found.error';
import { AchievementRepository } from '../infrastructure/achievement.repository';
import { toHistoryEntry } from '../lib/standings.mapper';
import { AchievementStatus } from '../model/standings.enums';
import type {
  Achievement,
  AchievementListFilter,
  AchievementPage,
  HistoryPage,
  PageRequest,
} from '../model/standings.types';

/**
 * Read side of achievements and the team history cabinet. The cabinet reads
 * APPROVED achievements only — an unreviewed claim is never history — and it
 * projects each one down to the privacy-safe reference set (ids, category,
 * title, date) so a public trophy list can never carry a member's profile.
 */
@Injectable()
export class AchievementQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: AchievementRepository,
  ) {}

  listForScope(
    teamId: string,
    filter: AchievementListFilter,
    page: PageRequest,
  ): Promise<AchievementPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.page(tx, teamId, filter, page),
    );
  }

  getById(teamId: string, achievementId: string): Promise<Achievement> {
    return this.unitOfWork.runInTransaction(tx =>
      this.require(tx, teamId, achievementId),
    );
  }

  history(
    teamId: string,
    filter: AchievementListFilter,
    page: PageRequest,
  ): Promise<HistoryPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.cabinet(tx, teamId, filter, page),
    );
  }

  async require(
    tx: TransactionScope,
    teamId: string,
    achievementId: string,
  ): Promise<Achievement> {
    const achievement = await this.repository.findForWrite(
      tx,
      teamId,
      achievementId,
    );
    if (achievement === null) {
      throw new AchievementNotFoundError();
    }
    return achievement;
  }

  private async page(
    tx: TransactionScope,
    teamId: string,
    filter: AchievementListFilter,
    page: PageRequest,
  ): Promise<AchievementPage> {
    const items = await this.repository.listForScope(tx, teamId, filter, page);
    const total = await this.repository.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async cabinet(
    tx: TransactionScope,
    teamId: string,
    filter: AchievementListFilter,
    page: PageRequest,
  ): Promise<HistoryPage> {
    const approved = { ...filter, status: AchievementStatus.Approved };
    const rows = await this.repository.listForScope(tx, teamId, approved, page);
    const total = await this.repository.countForScope(tx, teamId, approved);
    const items = rows
      .filter(row => isTeamVisible(row.visibility))
      .map(row => toHistoryEntry(row));
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
