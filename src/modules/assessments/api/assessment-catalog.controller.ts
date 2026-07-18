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

import { ArchiveMetricUseCase } from '../application/archive-metric.use-case';
import { AssessmentQueryService } from '../application/assessment-query.service';
import { CreateMetricUseCase } from '../application/create-metric.use-case';
import { CreateMetricVersionUseCase } from '../application/create-metric-version.use-case';
import { resolveAssessmentPage } from '../lib/assessments.helpers';
import {
  ASSESSMENT_CATALOG_ROUTE,
  ASSESSMENT_CATEGORIES_ROUTE,
  ASSESSMENT_METRIC_ARCHIVE_ROUTE,
  ASSESSMENT_METRIC_VERSIONS_ROUTE,
  ASSESSMENT_METRICS_ROUTE,
  ASSESSMENT_SCALES_ROUTE,
  ASSESSMENTS_API_TAG,
  METRIC_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/assessments.constants';
import { ArchiveMetricDto } from './dto/archive-metric.dto';
import { CreateMetricDto } from './dto/create-metric.dto';
import { ListCatalogQueryDto } from './dto/list-catalog.query.dto';
import { ListCategoriesResponseDto } from './dto/list-categories.response.dto';
import { ListMetricsResponseDto } from './dto/list-metrics.response.dto';
import { ListScalesResponseDto } from './dto/list-scales.response.dto';
import { MetricResponseDto } from './dto/metric-response.dto';

@ApiTags(ASSESSMENTS_API_TAG)
@Controller(ASSESSMENT_CATALOG_ROUTE)
export class AssessmentCatalogController {
  constructor(
    private readonly query: AssessmentQueryService,
    private readonly createMetric: CreateMetricUseCase,
    private readonly createMetricVersion: CreateMetricVersionUseCase,
    private readonly archiveMetric: ArchiveMetricUseCase,
  ) {}

  @Get(ASSESSMENT_CATEGORIES_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'List assessment metric categories' })
  @ApiOkResponse({ description: 'Categories', type: ListCategoriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listCategories(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) _teamId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<ListCategoriesResponseDto> {
    return this.query.listCategories(
      resolveAssessmentPage(query.limit, query.offset),
    );
  }

  @Get(ASSESSMENT_SCALES_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'List assessment scales' })
  @ApiOkResponse({ description: 'Scales', type: ListScalesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listScales(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) _teamId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<ListScalesResponseDto> {
    return this.query.listScales(
      resolveAssessmentPage(query.limit, query.offset),
    );
  }

  @Get(ASSESSMENT_METRICS_ROUTE)
  @RequirePermissions(Permission.AssessmentReadTeam)
  @ApiOperation({ summary: 'List current assessment metric definitions' })
  @ApiOkResponse({ description: 'Metrics', type: ListMetricsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listMetrics(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<ListMetricsResponseDto> {
    return this.query.listMetrics(
      teamId,
      resolveAssessmentPage(query.limit, query.offset),
    );
  }

  @Post(ASSESSMENT_METRICS_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a team metric definition (version 1)' })
  @ApiCreatedResponse({
    description: 'Metric created',
    type: MetricResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateMetricDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MetricResponseDto> {
    return this.createMetric.execute(actor, teamId, {
      key: dto.key,
      categoryId: dto.categoryId,
      scaleId: dto.scaleId,
      name: dto.name,
      definition: dto.definition,
      direction: dto.direction,
      guidance: dto.guidance,
      applicability: dto.applicability ?? [],
      tags: dto.tags ?? [],
    });
  }

  @Post(ASSESSMENT_METRIC_VERSIONS_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a new version of a metric definition' })
  @ApiCreatedResponse({
    description: 'Version created',
    type: MetricResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createVersion(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(METRIC_ID_PARAM, UuidValidationPipe) metricId: string,
    @Body() dto: CreateMetricDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MetricResponseDto> {
    return this.createMetricVersion.execute(actor, teamId, metricId, {
      key: dto.key,
      categoryId: dto.categoryId,
      scaleId: dto.scaleId,
      name: dto.name,
      definition: dto.definition,
      direction: dto.direction,
      guidance: dto.guidance,
      applicability: dto.applicability ?? [],
      tags: dto.tags ?? [],
    });
  }

  @Post(ASSESSMENT_METRIC_ARCHIVE_ROUTE)
  @RequirePermissions(Permission.AssessmentCreate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a metric definition (must be unused)' })
  @ApiOkResponse({ description: 'Metric archived', type: MetricResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(METRIC_ID_PARAM, UuidValidationPipe) metricId: string,
    @Body() dto: ArchiveMetricDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MetricResponseDto> {
    return this.archiveMetric.execute(actor, teamId, metricId, {
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
