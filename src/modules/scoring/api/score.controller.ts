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
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { RebuildScoreProjectionsUseCase } from '../application/rebuild-score-projections.use-case';
import { ScoreQueryService } from '../application/score-query.service';
import { resolveScoringPage } from '../lib/scoring.helpers';
import {
  MEMBERSHIP_ID_PARAM,
  PERFORMANCE_SCORES_ROUTE,
  SCORE_MEMBER_ROUTE,
  SCORE_REBUILD_ROUTE,
  SCORING_API_TAG,
  TEAM_ID_PARAM,
} from '../model/scoring.constants';
import { ListScoresResponseDto } from './dto/list-scores.response.dto';
import { ListScoringQueryDto } from './dto/list-scoring.query.dto';
import { RebuildResponseDto } from './dto/rebuild-response.dto';
import { ScoreListResponseDto } from './dto/score-list.response.dto';

/**
 * Team-facing performance-score reads (analytics.read.team) and the admin rebuild
 * trigger (points.rules.manage). Projections exist only for published rules, so an
 * unpublished rule's scores are never visible. Every list is bounded and
 * deterministically ordered.
 */
@ApiTags(SCORING_API_TAG)
@Controller(PERFORMANCE_SCORES_ROUTE)
export class ScoreController {
  constructor(
    private readonly query: ScoreQueryService,
    private readonly rebuild: RebuildScoreProjectionsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'List a team’s performance-score projections' })
  @ApiOkResponse({ type: ListScoresResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListScoringQueryDto,
  ): Promise<ListScoresResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveScoringPage(query.limit, query.offset),
    );
  }

  @Post(SCORE_REBUILD_ROUTE)
  @RequirePermissions(Permission.PointsRulesManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rebuild the team’s score projections' })
  @ApiOkResponse({ type: RebuildResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  rebuildScores(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RebuildResponseDto> {
    return this.rebuild.execute(actor, teamId);
  }

  @Get(SCORE_MEMBER_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Read one member’s performance scores' })
  @ApiOkResponse({ type: ScoreListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  member(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<ScoreListResponseDto> {
    return this.query.getForMembership(teamId, membershipId);
  }
}
