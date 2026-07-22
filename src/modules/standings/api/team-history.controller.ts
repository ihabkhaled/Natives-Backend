import { RequirePermissions } from '@core/auth';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AchievementQueryService } from '../application/achievement-query.service';
import { resolveStandingsPage } from '../lib/standings.helpers';
import { toAchievementListFilter } from '../lib/standings-command.mapper';
import {
  STANDINGS_API_TAG,
  TEAM_HISTORY_ROUTE,
  TEAM_ID_PARAM,
} from '../model/standings.constants';
import {
  AchievementListQueryDto,
  TeamHistoryResponseDto,
} from './dto/standings.dto';

/**
 * The Ultimate Natives trophy cabinet: approved achievements only, projected to
 * the privacy-safe reference set (ids, category, title, date). Staff-visibility
 * entries never appear here, so the history surface can be read by any team
 * member without exposing an internal award discussion.
 */
@ApiTags(STANDINGS_API_TAG)
@Controller(TEAM_HISTORY_ROUTE)
export class TeamHistoryController {
  constructor(private readonly query: AchievementQueryService) {}

  @Get()
  @RequirePermissions(Permission.TeamRead)
  @ApiOperation({ summary: 'Read the team’s approved history' })
  @ApiOkResponse({ type: TeamHistoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  history(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AchievementListQueryDto,
  ): Promise<TeamHistoryResponseDto> {
    return this.query.history(
      teamId,
      toAchievementListFilter(query),
      resolveStandingsPage(query.limit, query.offset),
    );
  }
}
