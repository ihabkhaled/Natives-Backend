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

import { PointsQueryService } from '../application/points-query.service';
import {
  MY_POINTS_ROUTE,
  POINTS_API_TAG,
  TEAM_ID_PARAM,
} from '../model/points.constants';
import { PointsSummaryResponseDto } from './dto/points-summary.response.dto';

/**
 * Member self-service read of their own points (points.read.self). The membership
 * is resolved from the authenticated identity, never a path or body parameter, so
 * a member can only ever read their own ledger total, history, and badges.
 */
@ApiTags(POINTS_API_TAG)
@Controller(MY_POINTS_ROUTE)
export class PointsSelfController {
  constructor(private readonly query: PointsQueryService) {}

  @Get()
  @RequirePermissions(Permission.PointsReadSelf)
  @ApiOperation({ summary: 'Read my own points summary' })
  @ApiOkResponse({ type: PointsSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  mine(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PointsSummaryResponseDto> {
    return this.query.myPoints(teamId, actor.userId);
  }
}
