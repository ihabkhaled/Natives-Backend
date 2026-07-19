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
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { GoalQueryService } from '../application/goal-query.service';
import { resolveDevelopmentPage } from '../lib/development.helpers';
import {
  DEVELOPMENT_API_TAG,
  MY_GOALS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/development.constants';
import { ListDevelopmentQueryDto } from './dto/list-development.query.dto';
import { ListDevelopmentGoalsResponseDto } from './dto/list-development-goals.response.dto';

/**
 * Member self-service surface. A member sees ONLY their own development goals
 * (and action plans), resolved from the authenticated identity against their
 * membership — never from a client-supplied id.
 */
@ApiTags(DEVELOPMENT_API_TAG)
@Controller(MY_GOALS_ROUTE)
export class DevelopmentGoalSelfController {
  constructor(private readonly query: GoalQueryService) {}

  @Get()
  @RequirePermissions(Permission.FeedbackReadSelf)
  @ApiOperation({ summary: 'List my own development goals for a team' })
  @ApiOkResponse({ type: ListDevelopmentGoalsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listOwn(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListDevelopmentQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListDevelopmentGoalsResponseDto> {
    return this.query.listForMember(
      teamId,
      actor.userId,
      resolveDevelopmentPage(query.limit, query.offset),
    );
  }
}
