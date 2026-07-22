import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
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

import { AnalyticsSeriesService } from '../application/analytics-series.service';
import { CohortComparisonService } from '../application/cohort-comparison.service';
import { RebuildAnalyticsUseCase } from '../application/rebuild-analytics.use-case';
import { resolveAnalyticsPage } from '../lib/analytics.helpers';
import {
  toCohortComparisonQuery,
  toSeriesQuery,
} from '../lib/analytics-command.mapper';
import {
  ANALYTICS_API_TAG,
  ANALYTICS_ROUTE,
  COHORT_COMPARISON_ROUTE,
  PLAYER_SERIES_ROUTE,
  REBUILD_ROUTE,
  SUBJECT_ID_PARAM,
  TEAM_ID_PARAM,
  TEAM_SERIES_ROUTE,
} from '../model/analytics.constants';
import { AnalyticsPeriodType } from '../model/analytics.enums';
import {
  AnalyticsSeriesQueryDto,
  AnalyticsSeriesResponseDto,
  CohortComparisonQueryDto,
  CohortComparisonResponseDto,
  RebuildAnalyticsDto,
  RebuildAnalyticsReportDto,
} from './dto/analytics.dto';

/**
 * HTTP surface for governed analytics read models. Player and team series are
 * analytics.read.team (the application applies scope and the visibility of the
 * team read model); the cohort comparison is analytics.read.team and is
 * suppressed below the privacy threshold; the rebuild is analytics.read.team +
 * data_quality.manage.
 */
@ApiTags(ANALYTICS_API_TAG)
@Controller(ANALYTICS_ROUTE)
export class AnalyticsController {
  constructor(
    private readonly series: AnalyticsSeriesService,
    private readonly cohorts: CohortComparisonService,
    private readonly rebuild: RebuildAnalyticsUseCase,
  ) {}

  @Get(PLAYER_SERIES_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Chart-ready series for a player dimension' })
  @ApiOkResponse({ type: AnalyticsSeriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  playerSeries(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SUBJECT_ID_PARAM, UuidValidationPipe) subjectId: string,
    @Query() query: AnalyticsSeriesQueryDto,
  ): Promise<AnalyticsSeriesResponseDto> {
    return this.series.playerSeries(
      teamId,
      subjectId,
      toSeriesQuery(query),
      resolveAnalyticsPage(query.limit, query.offset),
    );
  }

  @Get(TEAM_SERIES_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Chart-ready series for a team dimension' })
  @ApiOkResponse({ type: AnalyticsSeriesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  teamSeries(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AnalyticsSeriesQueryDto,
  ): Promise<AnalyticsSeriesResponseDto> {
    return this.series.teamSeries(
      teamId,
      toSeriesQuery(query),
      resolveAnalyticsPage(query.limit, query.offset),
    );
  }

  @Get(COHORT_COMPARISON_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Privacy-safe cohort comparison' })
  @ApiOkResponse({ type: CohortComparisonResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  cohortComparison(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: CohortComparisonQueryDto,
  ): Promise<CohortComparisonResponseDto> {
    return this.cohorts.compare(teamId, toCohortComparisonQuery(query));
  }

  @Post(REBUILD_ROUTE)
  @RequirePermissions(
    Permission.AnalyticsReadTeam,
    Permission.DataQualityManage,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Idempotently rebuild the analytics read model' })
  @ApiOkResponse({ type: RebuildAnalyticsReportDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  rebuildProjections(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: RebuildAnalyticsDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RebuildAnalyticsReportDto> {
    return this.rebuild.execute(actor, teamId, {
      seasonId: dto.seasonId ?? null,
      periodType: dto.periodType ?? AnalyticsPeriodType.Monthly,
    });
  }
}
