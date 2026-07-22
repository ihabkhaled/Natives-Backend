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

import { AnomalyQueryService } from '../application/anomaly-query.service';
import { RepairAnomalyUseCase } from '../application/repair-anomaly.use-case';
import { TransitionAnomalyUseCase } from '../application/transition-anomaly.use-case';
import { resolveDataQualityPage } from '../lib/dataquality.helpers';
import { toAnomalyListFilter } from '../lib/dataquality-command.mapper';
import {
  ANOMALIES_ROUTE,
  ANOMALY_ID_PARAM,
  ANOMALY_ITEM_ROUTE,
  ANOMALY_REPAIR_APPLY_ROUTE,
  ANOMALY_REPAIR_PREVIEW_ROUTE,
  ANOMALY_TRANSITION_ROUTE,
  DATA_QUALITY_API_TAG,
  REPAIR_ROLLBACK_ROUTE,
  TEAM_ID_PARAM,
} from '../model/dataquality.constants';
import {
  AnomalyListQueryDto,
  AnomalyResponseDto,
  ListAnomaliesResponseDto,
  RepairPreviewResponseDto,
  RepairResponseDto,
  TransitionAnomalyDto,
} from './dto/dataquality.dto';

/**
 * HTTP surface for the data-quality queue (data_quality.manage). Scanning is
 * read-only detection; anomaly transitions manage the queue; repairs are always
 * previewed before they are applied, and applied only through the owning
 * service with a recorded rollback.
 */
@ApiTags(DATA_QUALITY_API_TAG)
@Controller(ANOMALIES_ROUTE)
export class DataQualityController {
  constructor(
    private readonly query: AnomalyQueryService,
    private readonly transitionAnomaly: TransitionAnomalyUseCase,
    private readonly repair: RepairAnomalyUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.DataQualityManage)
  @ApiOperation({ summary: 'List the anomaly queue' })
  @ApiOkResponse({ type: ListAnomaliesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AnomalyListQueryDto,
  ): Promise<ListAnomaliesResponseDto> {
    return this.query.listForScope(
      teamId,
      toAnomalyListFilter(query),
      resolveDataQualityPage(query.limit, query.offset),
    );
  }

  @Get(ANOMALY_ITEM_ROUTE)
  @RequirePermissions(Permission.DataQualityManage)
  @ApiOperation({ summary: 'Get one anomaly' })
  @ApiOkResponse({ type: AnomalyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ANOMALY_ID_PARAM, UuidValidationPipe) anomalyId: string,
  ): Promise<AnomalyResponseDto> {
    return this.query.getById(teamId, anomalyId);
  }

  @Get(ANOMALY_REPAIR_PREVIEW_ROUTE)
  @RequirePermissions(Permission.DataQualityManage)
  @ApiOperation({ summary: 'Preview a repair’s impact (read-only)' })
  @ApiOkResponse({ type: RepairPreviewResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  previewRepair(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ANOMALY_ID_PARAM, UuidValidationPipe) anomalyId: string,
  ): Promise<RepairPreviewResponseDto> {
    return this.repair.preview(teamId, anomalyId);
  }

  @Post(ANOMALY_TRANSITION_ROUTE)
  @RequirePermissions(Permission.DataQualityManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge, resolve, suppress, or reopen' })
  @ApiOkResponse({ type: AnomalyResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ANOMALY_ID_PARAM, UuidValidationPipe) anomalyId: string,
    @Body() dto: TransitionAnomalyDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AnomalyResponseDto> {
    return this.transitionAnomaly.execute(actor, teamId, anomalyId, {
      transition: dto.transition,
      resolution: dto.resolution ?? null,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(ANOMALY_REPAIR_APPLY_ROUTE)
  @RequirePermissions(Permission.DataQualityManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a previewed repair' })
  @ApiOkResponse({ type: RepairResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  applyRepair(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ANOMALY_ID_PARAM, UuidValidationPipe) anomalyId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RepairResponseDto> {
    return this.repair.apply(actor, teamId, anomalyId);
  }

  @Post(REPAIR_ROLLBACK_ROUTE)
  @RequirePermissions(Permission.DataQualityManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Roll back an applied repair' })
  @ApiOkResponse({ type: RepairResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  rollbackRepair(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(ANOMALY_ID_PARAM, UuidValidationPipe) anomalyId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RepairResponseDto> {
    return this.repair.rollback(actor, teamId, anomalyId);
  }
}
