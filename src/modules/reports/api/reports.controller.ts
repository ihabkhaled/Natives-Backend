import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { GenerateReportUseCase } from '../application/generate-report.use-case';
import { ReportDownloadService } from '../application/report-download.service';
import { ReportQueryService } from '../application/report-query.service';
import { RetryReportUseCase } from '../application/retry-report.use-case';
import { resolveReportsPage } from '../lib/reports.helpers';
import {
  toReportListFilter,
  toReportRequest,
} from '../lib/reports-command.mapper';
import {
  JOB_ID_PARAM,
  REPORT_DOWNLOAD_ROUTE,
  REPORT_ITEM_ROUTE,
  REPORT_RETRY_ROUTE,
  REPORTS_API_TAG,
  REPORTS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/reports.constants';
import {
  GenerateReportDto,
  ListReportJobsResponseDto,
  ReportDownloadResponseDto,
  ReportJobResponseDto,
  ReportListQueryDto,
} from './dto/reports.dto';

/**
 * HTTP surface for asynchronous report generation. Listing and reading a job is
 * report.read; requesting, retrying, and downloading are report.generate. The
 * generation is queued and idempotent by request hash, and the download returns
 * a short-lived signed URL — the artifact never streams through the API.
 */
@ApiTags(REPORTS_API_TAG)
@Controller(REPORTS_ROUTE)
export class ReportsController {
  constructor(
    private readonly query: ReportQueryService,
    private readonly generate: GenerateReportUseCase,
    private readonly retryReport: RetryReportUseCase,
    private readonly downloads: ReportDownloadService,
  ) {}

  @Get()
  @RequirePermissions(Permission.ReportRead)
  @ApiOperation({ summary: 'List a team’s report jobs' })
  @ApiOkResponse({ type: ListReportJobsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ReportListQueryDto,
  ): Promise<ListReportJobsResponseDto> {
    return this.query.listForScope(
      teamId,
      toReportListFilter(query),
      resolveReportsPage(query.limit, query.offset),
    );
  }

  @Get(REPORT_ITEM_ROUTE)
  @RequirePermissions(Permission.ReportRead)
  @ApiOperation({ summary: 'Get one report job' })
  @ApiOkResponse({ type: ReportJobResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
  ): Promise<ReportJobResponseDto> {
    return this.query.getById(teamId, jobId);
  }

  @Get(REPORT_DOWNLOAD_ROUTE)
  @RequirePermissions(Permission.ReportGenerate)
  @ApiOperation({ summary: 'Mint a short-lived signed download URL' })
  @ApiOkResponse({ type: ReportDownloadResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  download(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReportDownloadResponseDto> {
    return this.downloads.createTicket(actor, teamId, jobId);
  }

  @Post()
  @RequirePermissions(Permission.ReportGenerate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request an asynchronous report' })
  @ApiCreatedResponse({ type: ReportJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: GenerateReportDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReportJobResponseDto> {
    return this.generate.execute(actor, teamId, {
      request: toReportRequest(dto),
    });
  }

  @Post(REPORT_RETRY_ROUTE)
  @RequirePermissions(Permission.ReportGenerate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed report job' })
  @ApiOkResponse({ type: ReportJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  retry(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ReportJobResponseDto> {
    return this.retryReport.execute(actor, teamId, jobId);
  }
}
