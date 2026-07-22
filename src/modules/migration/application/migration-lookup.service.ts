import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { AliasResolutionNotFoundError } from '../errors/alias-resolution-not-found.error';
import { ComparisonNotFoundError } from '../errors/comparison-not-found.error';
import { ImportJobNotFoundError } from '../errors/import-job-not-found.error';
import { MigrationScopeNotFoundError } from '../errors/migration-scope-not-found.error';
import { AliasResolutionRepository } from '../infrastructure/alias-resolution.repository';
import { FormulaComparisonRepository } from '../infrastructure/formula-comparison.repository';
import { ImportJobRepository } from '../infrastructure/import-job.repository';
import { MigrationScopeRepository } from '../infrastructure/migration-scope.repository';
import type {
  AliasResolution,
  FormulaComparison,
  ImportJob,
} from '../model/migration.types';

/**
 * Resolves team-owned migration records, translating a miss into a 404 that
 * hides existence, and validates the team/member scope of a write.
 */
@Injectable()
export class MigrationLookupService {
  constructor(
    private readonly scopes: MigrationScopeRepository,
    private readonly imports: ImportJobRepository,
    private readonly aliases: AliasResolutionRepository,
    private readonly comparisons: FormulaComparisonRepository,
  ) {}

  async requireTeam(scope: TransactionScope, teamId: string): Promise<void> {
    if (!(await this.scopes.activeTeamExists(scope, teamId))) {
      throw new MigrationScopeNotFoundError();
    }
  }

  async requireMember(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<void> {
    if (!(await this.scopes.membershipExists(scope, teamId, membershipId))) {
      throw new MigrationScopeNotFoundError();
    }
  }

  async requireImport(
    scope: TransactionScope,
    teamId: string,
    jobId: string,
  ): Promise<ImportJob> {
    const job = await this.imports.findForWrite(scope, teamId, jobId);
    if (job === null) {
      throw new ImportJobNotFoundError();
    }
    return job;
  }

  async requireAlias(
    scope: TransactionScope,
    teamId: string,
    resolutionId: string,
  ): Promise<AliasResolution> {
    const resolution = await this.aliases.findForWrite(
      scope,
      teamId,
      resolutionId,
    );
    if (resolution === null) {
      throw new AliasResolutionNotFoundError();
    }
    return resolution;
  }

  async requireComparison(
    scope: TransactionScope,
    teamId: string,
    comparisonId: string,
  ): Promise<FormulaComparison> {
    const comparison = await this.comparisons.findForWrite(
      scope,
      teamId,
      comparisonId,
    );
    if (comparison === null) {
      throw new ComparisonNotFoundError();
    }
    return comparison;
  }
}
