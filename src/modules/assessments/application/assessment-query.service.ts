import {
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AssessmentCatalogRepository } from '../infrastructure/assessment-catalog.repository';
import type {
  AssessmentCategoryPage,
  AssessmentMetricPage,
  AssessmentPeriodPage,
  AssessmentScalePage,
  AssessmentTemplatePage,
  PageRequest,
} from '../model/assessments.types';

/**
 * Read side of the assessment catalog. Every list is a single bounded,
 * deterministically ordered page executed inside one transaction. Categories and
 * scales are global reference data; metrics, templates, and periods are resolved
 * within the team scope the route param carries and the permission guard enforces.
 */
@Injectable()
export class AssessmentQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly catalog: AssessmentCatalogRepository,
  ) {}

  listCategories(page: PageRequest): Promise<AssessmentCategoryPage> {
    return this.unitOfWork.runInTransaction(scope =>
      this.catalog.listCategories(scope, page),
    );
  }

  listScales(page: PageRequest): Promise<AssessmentScalePage> {
    return this.unitOfWork.runInTransaction(scope =>
      this.catalog.listScales(scope, page),
    );
  }

  listMetrics(
    teamId: string,
    page: PageRequest,
  ): Promise<AssessmentMetricPage> {
    return this.unitOfWork.runInTransaction(scope =>
      this.catalog.listMetrics(scope, teamId, page),
    );
  }

  listTemplates(
    teamId: string,
    page: PageRequest,
  ): Promise<AssessmentTemplatePage> {
    return this.unitOfWork.runInTransaction(scope =>
      this.catalog.listTemplates(scope, teamId, page),
    );
  }

  listPeriods(
    teamId: string,
    page: PageRequest,
  ): Promise<AssessmentPeriodPage> {
    return this.unitOfWork.runInTransaction(scope =>
      this.catalog.listPeriods(scope, teamId, page),
    );
  }
}
