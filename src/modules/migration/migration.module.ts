import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { XlsxWorkbookParserAdapter } from './adapters/xlsx-workbook-parser.adapter';
import { AliasResolutionsController } from './api/alias-resolutions.controller';
import { FormulaComparisonsController } from './api/formula-comparisons.controller';
import { ImportsController } from './api/imports.controller';
import { CommitImportUseCase } from './application/commit-import.use-case';
import { CompareFormulaUseCase } from './application/compare-formula.use-case';
import { MigrationLookupService } from './application/migration-lookup.service';
import { MigrationQueryService } from './application/migration-query.service';
import { ResolveAliasUseCase } from './application/resolve-alias.use-case';
import { RowParserService } from './application/row-parser.service';
import { StageImportUseCase } from './application/stage-import.use-case';
import { AliasResolutionRepository } from './infrastructure/alias-resolution.repository';
import { FormulaComparisonRepository } from './infrastructure/formula-comparison.repository';
import { ImportJobRepository } from './infrastructure/import-job.repository';
import { MigrationScopeRepository } from './infrastructure/migration-scope.repository';
import { WORKBOOK_PARSER_PORT } from './model/migration.constants';

/**
 * Legacy migration: import framework, identity aliases, and formula comparison
 * sign-off (UN-702, UN-703, UN-704). Owns its persistence (raw SQL via the
 * global UnitOfWorkPort) and composes the platform audit primitive.
 *
 * Three invariants shape the module. Source files are PRIVATE transient inputs —
 * only a content hash is stored, every import begins with a DRY RUN, and a retry
 * cannot duplicate entities. Legacy names are resolved to stable players with a
 * confidence, but only a HUMAN confirms an ambiguous one and an alias never
 * silently maps two distinct people. And a target-vs-legacy difference is
 * classified and requires a NAMED sign-off before production import — the target
 * is never forced to match a known `#REF!`/`#N/A` legacy defect.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [
    ImportsController,
    AliasResolutionsController,
    FormulaComparisonsController,
  ],
  providers: [
    { provide: WORKBOOK_PARSER_PORT, useClass: XlsxWorkbookParserAdapter },
    MigrationScopeRepository,
    ImportJobRepository,
    AliasResolutionRepository,
    FormulaComparisonRepository,
    MigrationLookupService,
    MigrationQueryService,
    RowParserService,
    StageImportUseCase,
    CommitImportUseCase,
    ResolveAliasUseCase,
    CompareFormulaUseCase,
  ],
})
export class MigrationModule {}
