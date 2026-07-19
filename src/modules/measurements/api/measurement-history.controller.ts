import { RequirePermissions } from '@core/auth';
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
  HISTORY_MEMBER_ROUTE,
  MEASUREMENT_HISTORY_ROUTE,
  MEASUREMENTS_API_TAG,
  MEMBERSHIP_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/measurements.constants';
import { HistoryResponseDto } from './dto/history-response.dto';

/**
 * Team-facing read of any player's objective-measurement history
 * (analytics.read.team): every protocol the player has attempts for, with the
 * per-protocol best/average result derived by policy and missing attempts excluded.
 */
@ApiTags(MEASUREMENTS_API_TAG)
@Controller(MEASUREMENT_HISTORY_ROUTE)
export class MeasurementHistoryController {
  constructor(private readonly history: MeasurementHistoryService) {}

  @Get(HISTORY_MEMBER_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Read a player’s measurement history' })
  @ApiOkResponse({ type: HistoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  forMember(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<HistoryResponseDto> {
    return this.history.getForMembership(teamId, membershipId);
  }
}
