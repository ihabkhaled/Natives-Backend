import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { MatchStatisticsService } from '../application/match-statistics.service';
import { RebuildMatchStatisticsUseCase } from '../application/rebuild-match-statistics.use-case';
import {
  MATCH_ID_PARAM,
  MATCH_STATISTICS_ROUTE,
  MATCHES_API_TAG,
  STATISTICS_REBUILD_ROUTE,
  TEAM_ID_PARAM,
} from '../model/matches.constants';
import { MatchStatisticsResponseDto } from './dto/match-statistics.response.dto';

/**
 * HTTP surface for the derived match statistics (match.stats.read).
 *
 * There is no write endpoint for a statistic, because there is no stored total
 * to write: reading and rebuilding both run the SAME pure derivation over the
 * append-only stream, so a rebuild is identical to a clean replay by
 * construction. The rebuild exists only to re-publish `match.stats_projected`
 * for downstream consumers and to record who asked for it.
 */
@ApiTags(MATCHES_API_TAG)
@Controller(MATCH_STATISTICS_ROUTE)
export class MatchStatisticsController {
  constructor(
    private readonly statistics: MatchStatisticsService,
    private readonly rebuild: RebuildMatchStatisticsUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchStatsRead)
  @ApiOperation({ summary: 'Derive the match statistics from the stream' })
  @ApiOkResponse({ type: MatchStatisticsResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Match not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
  ): Promise<MatchStatisticsResponseDto> {
    return this.statistics.getForMatch(teamId, matchId);
  }

  @Post(STATISTICS_REBUILD_ROUTE)
  @RequirePermissions(Permission.MatchStatsRead)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rebuild the projection and publish the event' })
  @ApiOkResponse({ type: MatchStatisticsResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Match not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  rebuildStatistics(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchStatisticsResponseDto> {
    return this.rebuild.execute(actor, teamId, matchId);
  }
}
