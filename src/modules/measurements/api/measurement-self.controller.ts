import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, Get, Param } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { MeasurementHistoryService } from '../application/measurement-history.service';
import {
  MEASUREMENTS_API_TAG,
  MY_MEASUREMENTS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/measurements.constants';
import { HistoryResponseDto } from './dto/history-response.dto';

/**
 * Member self-service read of their own objective-measurement history
 * (analytics.read.self). The membership is resolved from the authenticated
 * identity, never a path or body parameter, so a member can only ever read their own.
 */
@ApiTags(MEASUREMENTS_API_TAG)
@Controller(MY_MEASUREMENTS_ROUTE)
export class MeasurementSelfController {
  constructor(private readonly history: MeasurementHistoryService) {}

  @Get()
  @RequirePermissions(Permission.AnalyticsReadSelf)
  @ApiOperation({ summary: 'Read my own measurement history' })
  @ApiOkResponse({ type: HistoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  mine(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<HistoryResponseDto> {
    return this.history.getForUser(teamId, actor.userId);
  }
}
