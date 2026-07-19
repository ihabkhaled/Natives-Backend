import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { ScoreProjectionNotFoundError } from '../errors/score-projection-not-found.error';
import { ScoreProjectionRepository } from '../infrastructure/score-projection.repository';
import type {
  PageRequest,
  ScoreProjectionList,
  ScoreProjectionPage,
} from '../model/scoring.types';

/**
 * Read side of performance-score projections. Projections exist only for
 * published rules, so an unpublished rule's scores are never visible. Team reads
 * (analytics.read.team) see the whole team; the member self read
 * (analytics.read.self) is resolved from the authenticated identity and returns
 * only the caller's own scores. Every list is bounded and deterministically
 * ordered in one transaction.
 */
@Injectable()
export class ScoreQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: ScoreProjectionRepository,
  ) {}

  listForTeam(teamId: string, page: PageRequest): Promise<ScoreProjectionPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.teamPage(tx, teamId, page),
    );
  }

  getForMembership(
    teamId: string,
    membershipId: string,
  ): Promise<ScoreProjectionList> {
    return this.unitOfWork.runInTransaction(tx =>
      this.membershipScores(tx, teamId, membershipId),
    );
  }

  getForUser(teamId: string, userId: string): Promise<ScoreProjectionList> {
    return this.unitOfWork.runInTransaction(async tx => ({
      items: await this.repository.listForUser(tx, teamId, userId),
    }));
  }

  private async teamPage(
    tx: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ScoreProjectionPage> {
    const items = await this.repository.listForTeam(tx, teamId, page);
    const total = await this.repository.countForTeam(tx, teamId);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async membershipScores(
    tx: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<ScoreProjectionList> {
    const items = await this.repository.listForMembership(
      tx,
      teamId,
      membershipId,
    );
    if (items.length === 0) {
      throw new ScoreProjectionNotFoundError();
    }
    return { items };
  }
}
