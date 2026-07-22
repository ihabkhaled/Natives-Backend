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

import { CommitImportUseCase } from '../application/commit-import.use-case';
import { MigrationQueryService } from '../application/migration-query.service';
import { StageImportUseCase } from '../application/stage-import.use-case';
import { resolveMigrationPage } from '../lib/migration.helpers';
import {
  toImportListFilter,
  toStageImportCommand,
} from '../lib/migration-command.mapper';
import {
  IMPORT_COMMIT_ROUTE,
  IMPORT_ITEM_ROUTE,
  IMPORT_RESULTS_ROUTE,
  IMPORT_REVERSAL_ROUTE,
  IMPORTS_ROUTE,
  JOB_ID_PARAM,
  MIGRATION_API_TAG,
  TEAM_ID_PARAM,
} from '../model/migration.constants';
import {
  ImportJobResponseDto,
  ImportListQueryDto,
  ListImportJobsResponseDto,
  ListImportRowResultsResponseDto,
  StageImportDto,
} from './dto/migration.dto';

/**
 * HTTP surface for the private import framework (import.manage). Staging is
 * dry-run first; commit and reversal are distinct, guarded steps. Source files
 * are never accepted here as bytes — only structured, validated rows.
 */
@ApiTags(MIGRATION_API_TAG)
@Controller(IMPORTS_ROUTE)
export class ImportsController {
  constructor(
    private readonly query: MigrationQueryService,
    private readonly stageImport: StageImportUseCase,
    private readonly commitImport: CommitImportUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'List import jobs' })
  @ApiOkResponse({ type: ListImportJobsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ImportListQueryDto,
  ): Promise<ListImportJobsResponseDto> {
    return this.query.listImports(
      teamId,
      toImportListFilter(query),
      resolveMigrationPage(query.limit, query.offset),
    );
  }

  @Get(IMPORT_ITEM_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'Get one import job' })
  @ApiOkResponse({ type: ImportJobResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
  ): Promise<ImportJobResponseDto> {
    return this.query.getImport(teamId, jobId);
  }

  @Get(IMPORT_RESULTS_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @ApiOperation({ summary: 'List the per-row reconciliation of a job' })
  @ApiOkResponse({ type: ListImportRowResultsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  results(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
  ): Promise<ListImportRowResultsResponseDto> {
    return this.query.listResults(teamId, jobId);
  }

  @Post()
  @RequirePermissions(Permission.ImportManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Stage an audited workbook (dry run first)' })
  @ApiCreatedResponse({ type: ImportJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  stage(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: StageImportDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ImportJobResponseDto> {
    return this.stageImport.execute(actor, teamId, toStageImportCommand(dto));
  }

  @Post(IMPORT_COMMIT_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Commit a staged import' })
  @ApiOkResponse({ type: ImportJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  commit(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ImportJobResponseDto> {
    return this.commitImport.commit(actor, teamId, jobId);
  }

  @Post(IMPORT_REVERSAL_ROUTE)
  @RequirePermissions(Permission.ImportManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Reverse a committed import' })
  @ApiCreatedResponse({ type: ImportJobResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reverse(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(JOB_ID_PARAM, UuidValidationPipe) jobId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ImportJobResponseDto> {
    return this.commitImport.reverse(actor, teamId, jobId);
  }
}
