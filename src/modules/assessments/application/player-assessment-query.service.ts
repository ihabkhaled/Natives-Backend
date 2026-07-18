import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { PlayerAssessmentNotFoundError } from '../errors/player-assessment-not-found.error';
import { PlayerAssessmentRepository } from '../infrastructure/player-assessment.repository';
import { toPlayerPublishedAssessment } from '../lib/player-assessments.mapper';
import type { PageRequest } from '../model/assessments.types';
import type {
  OwnPublishedResult,
  PlayerAssessmentDetail,
  PlayerAssessmentSummaryPage,
  PlayerAssessmentValue,
  PlayerPublishedAssessmentPage,
  RevisionHistory,
} from '../model/player-assessments.types';

/**
 * Read side of the per-player assessment workflow. Every list is a single
 * bounded, deterministically ordered page in one transaction. Team reads
 * (assessment.read.team) see full detail including private notes; the player self
 * read (assessment.read.self.published) returns ONLY the caller's own current
 * published/revised assessments, shaped to exclude private notes.
 */
@Injectable()
export class PlayerAssessmentQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly repository: PlayerAssessmentRepository,
  ) {}

  listForTeam(
    teamId: string,
    page: PageRequest,
  ): Promise<PlayerAssessmentSummaryPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.repository.listForTeam(tx, teamId, page),
    );
  }

  getDetail(
    teamId: string,
    assessmentId: string,
  ): Promise<PlayerAssessmentDetail> {
    return this.unitOfWork.runInTransaction(tx =>
      this.requireDetail(tx, teamId, assessmentId),
    );
  }

  listRevisions(
    teamId: string,
    assessmentId: string,
  ): Promise<RevisionHistory> {
    return this.unitOfWork.runInTransaction(tx =>
      this.revisions(tx, teamId, assessmentId),
    );
  }

  listOwnPublished(
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<PlayerPublishedAssessmentPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.ownPublished(tx, teamId, userId, page),
    );
  }

  private async requireDetail(
    tx: TransactionScope,
    teamId: string,
    assessmentId: string,
  ): Promise<PlayerAssessmentDetail> {
    const detail = await this.repository.findDetail(tx, teamId, assessmentId);
    if (detail === null) {
      throw new PlayerAssessmentNotFoundError();
    }
    return detail;
  }

  private async revisions(
    tx: TransactionScope,
    teamId: string,
    assessmentId: string,
  ): Promise<RevisionHistory> {
    const assessment = await this.repository.findForWrite(
      tx,
      teamId,
      assessmentId,
    );
    if (assessment === null) {
      throw new PlayerAssessmentNotFoundError();
    }
    return this.repository.listRevisions(tx, teamId, assessment.familyId);
  }

  private async ownPublished(
    tx: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<PlayerPublishedAssessmentPage> {
    const found = await this.repository.listOwnPublished(
      tx,
      teamId,
      userId,
      page,
    );
    const values = await this.repository.valuesByAssessment(
      tx,
      found.assessments.map(assessment => assessment.id),
    );
    return this.assemblePage(found, values, page);
  }

  private assemblePage(
    found: OwnPublishedResult,
    values: ReadonlyMap<string, readonly PlayerAssessmentValue[]>,
    page: PageRequest,
  ): PlayerPublishedAssessmentPage {
    return {
      items: found.assessments.map(assessment =>
        toPlayerPublishedAssessment(
          assessment,
          values.get(assessment.id) ?? [],
        ),
      ),
      total: found.total,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
