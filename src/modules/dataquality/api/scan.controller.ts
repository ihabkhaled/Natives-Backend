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
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ScanUseCase } from '../application/scan.use-case';
import { toScanCommand } from '../lib/dataquality-command.mapper';
import {
  DATA_QUALITY_API_TAG,
  SCAN_ROUTE,
  TEAM_ID_PARAM,
} from '../model/dataquality.constants';
import {
  ScanDataQualityDto,
  ScanReportResponseDto,
} from './dto/dataquality.dto';

/**
 * HTTP surface for the read-only data-quality scan (data_quality.manage). The
 * scan detects anomalies and folds them into the queue; it never mutates data.
 */
@ApiTags(DATA_QUALITY_API_TAG)
@Controller(SCAN_ROUTE)
export class ScanController {
  constructor(private readonly scan: ScanUseCase) {}

  @Post()
  @RequirePermissions(Permission.DataQualityManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a read-only data-quality scan' })
  @ApiOkResponse({ type: ScanReportResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  run(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: ScanDataQualityDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScanReportResponseDto> {
    return this.scan.execute(actor, teamId, toScanCommand(dto));
  }
}
