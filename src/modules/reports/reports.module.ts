import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { PlatformModule } from '@modules/platform';
import { Module } from '@nestjs/common';

import { CsvXlsxPdfDocumentAdapter } from './adapters/csv-xlsx-pdf-document.adapter';
import { SignedReportDownloadAdapter } from './adapters/signed-report-download.adapter';
import { ReportsController } from './api/reports.controller';
import { GenerateReportUseCase } from './application/generate-report.use-case';
import { ReportDatasetService } from './application/report-dataset.service';
import { ReportDownloadService } from './application/report-download.service';
import { ReportQueryService } from './application/report-query.service';
import { RetryReportUseCase } from './application/retry-report.use-case';
import { ReportDataRepository } from './infrastructure/report-data.repository';
import { ReportJobRepository } from './infrastructure/report-job.repository';
import {
  REPORT_DOCUMENT_PORT,
  REPORT_DOWNLOAD_PORT,
} from './model/reports.constants';

/**
 * Report catalog and asynchronous generation (UN-701). Owns its persistence (raw
 * SQL via the global UnitOfWorkPort) and composes the platform audit primitive.
 *
 * Three invariants shape the module. Generation is ASYNCHRONOUS and idempotent:
 * a job snapshots the data at a fixed instant, has a terminal status (never an
 * endless loading state), and a re-request replays to the same job. Documents
 * are produced ONLY behind adapters that neutralize CSV/XLSX formula injection
 * and strip off-schema fields, and complete rosters include the zero-
 * contribution members. Delivery is a short-lived SIGNED URL with a checksum —
 * the artifact never streams through the application.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, PlatformModule],
  controllers: [ReportsController],
  providers: [
    { provide: REPORT_DOCUMENT_PORT, useClass: CsvXlsxPdfDocumentAdapter },
    { provide: REPORT_DOWNLOAD_PORT, useClass: SignedReportDownloadAdapter },
    ReportJobRepository,
    ReportDataRepository,
    ReportDatasetService,
    ReportQueryService,
    GenerateReportUseCase,
    RetryReportUseCase,
    ReportDownloadService,
  ],
})
export class ReportsModule {}
