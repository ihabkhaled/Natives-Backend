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

import { ScoreQueryService } from '../application/score-query.service';
import {
  MY_PERFORMANCE_SCORE_ROUTE,
  SCORING_API_TAG,
  TEAM_ID_PARAM,
} from '../model/scoring.constants';
import { ScoreListResponseDto } from './dto/score-list.response.dto';

/**
 * Member self-service read of their own performance scores (analytics.read.self).
 * The membership is resolved from the authenticated identity, never a path or
 * body parameter, so a member can only ever read their own projection.
 */
@ApiTags(SCORING_API_TAG)
@Controller(MY_PERFORMANCE_SCORE_ROUTE)
export class ScoreSelfController {
  constructor(private readonly query: ScoreQueryService) {}

  @Get()
  @RequirePermissions(Permission.AnalyticsReadSelf)
  @ApiOperation({ summary: 'Read my own performance scores' })
  @ApiOkResponse({ type: ScoreListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  mine(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScoreListResponseDto> {
    return this.query.getForUser(teamId, actor.userId);
  }
}
