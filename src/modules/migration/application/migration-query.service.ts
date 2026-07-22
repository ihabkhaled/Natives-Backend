import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { AliasResolutionRepository } from '../infrastructure/alias-resolution.repository';
import { FormulaComparisonRepository } from '../infrastructure/formula-comparison.repository';
import { ImportJobRepository } from '../infrastructure/import-job.repository';
import type {
  AliasListFilter,
  AliasResolution,
  AliasResolutionPage,
  ComparisonListFilter,
  FormulaComparison,
  FormulaComparisonPage,
  ImportJob,
  ImportJobPage,
  ImportListFilter,
  PageRequest,
  RowResultList,
} from '../model/migration.types';
import { MigrationLookupService } from './migration-lookup.service';

/**
 * Read side of import jobs, alias resolutions, and formula comparisons. Every
 * read is a bounded, deterministically ordered page under allow-listed filters,
 * or a single record resolved through the team-scoped lookup (a miss is a 404).
 */
@Injectable()
export class MigrationQueryService {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    private readonly imports: ImportJobRepository,
    private readonly aliases: AliasResolutionRepository,
    private readonly comparisons: FormulaComparisonRepository,
    private readonly lookup: MigrationLookupService,
  ) {}

  listImports(
    teamId: string,
    filter: ImportListFilter,
    page: PageRequest,
  ): Promise<ImportJobPage> {
    return this.unitOfWork.runInTransaction(async tx => {
      const items = await this.imports.listForScope(tx, teamId, filter, page);
      const total = await this.imports.countForScope(tx, teamId, filter);
      return { items, total, limit: page.limit, offset: page.offset };
    });
  }

  getImport(teamId: string, jobId: string): Promise<ImportJob> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireImport(tx, teamId, jobId),
    );
  }

  listResults(teamId: string, jobId: string): Promise<RowResultList> {
    return this.unitOfWork.runInTransaction(async tx => {
      await this.lookup.requireImport(tx, teamId, jobId);
      const items = await this.imports.listResults(tx, jobId);
      return { items };
    });
  }

  listAliases(
    teamId: string,
    filter: AliasListFilter,
    page: PageRequest,
  ): Promise<AliasResolutionPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.aliasPage(tx, teamId, filter, page),
    );
  }

  listComparisons(
    teamId: string,
    filter: ComparisonListFilter,
    page: PageRequest,
  ): Promise<FormulaComparisonPage> {
    return this.unitOfWork.runInTransaction(tx =>
      this.comparisonPage(tx, teamId, filter, page),
    );
  }

  getComparison(
    teamId: string,
    comparisonId: string,
  ): Promise<FormulaComparison> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireComparison(tx, teamId, comparisonId),
    );
  }

  getAlias(teamId: string, resolutionId: string): Promise<AliasResolution> {
    return this.unitOfWork.runInTransaction(tx =>
      this.lookup.requireAlias(tx, teamId, resolutionId),
    );
  }

  private async aliasPage(
    tx: TransactionScope,
    teamId: string,
    filter: AliasListFilter,
    page: PageRequest,
  ): Promise<AliasResolutionPage> {
    const items = await this.aliases.listForScope(tx, teamId, filter, page);
    const total = await this.aliases.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }

  private async comparisonPage(
    tx: TransactionScope,
    teamId: string,
    filter: ComparisonListFilter,
    page: PageRequest,
  ): Promise<FormulaComparisonPage> {
    const items = await this.comparisons.listForScope(tx, teamId, filter, page);
    const total = await this.comparisons.countForScope(tx, teamId, filter);
    return { items, total, limit: page.limit, offset: page.offset };
  }
}
