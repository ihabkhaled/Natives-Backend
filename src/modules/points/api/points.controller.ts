import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
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

import { CreateAdjustmentUseCase } from '../application/create-adjustment.use-case';
import { LeaderboardQueryService } from '../application/leaderboard-query.service';
import { PointsQueryService } from '../application/points-query.service';
import { resolveLeaderboardQuery } from '../lib/leaderboard.mapper';
import {
  MEMBERSHIP_ID_PARAM,
  POINTS_ADJUSTMENT_ROUTE,
  POINTS_API_TAG,
  POINTS_MEMBER_ROUTE,
  POINTS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/points.constants';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { LeaderboardResponseDto } from './dto/leaderboard.response.dto';
import { ListLeaderboardQueryDto } from './dto/list-leaderboard.query.dto';
import { PointsSummaryResponseDto } from './dto/points-summary.response.dto';

/**
 * Team-facing points reads and the admin adjustment surface (points.adjust).
 * The leaderboard read is gated by leaderboard.read — the permission the member
 * bundle carries and navigation advertises — while the per-member summary stays
 * behind the staff-level points.read.team. Totals are ledger projections — never
 * stored counters — and every list is bounded and deterministically ordered.
 * Manual adjustments append an audited, idempotent ledger entry; the actor
 * comes from the token.
 */
@ApiTags(POINTS_API_TAG)
@Controller(POINTS_ROUTE)
export class PointsController {
  constructor(
    private readonly query: PointsQueryService,
    private readonly leaderboard: LeaderboardQueryService,
    private readonly adjust: CreateAdjustmentUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.LeaderboardRead)
  @ApiOperation({ summary: 'Read the team points leaderboard' })
  @ApiOkResponse({ type: LeaderboardResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  teamLeaderboard(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListLeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboard.teamLeaderboard(
      teamId,
      resolveLeaderboardQuery(query),
    );
  }

  @Get(POINTS_MEMBER_ROUTE)
  @RequirePermissions(Permission.PointsReadTeam)
  @ApiOperation({ summary: 'Read one member’s points summary' })
  @ApiOkResponse({ type: PointsSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  member(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<PointsSummaryResponseDto> {
    return this.query.memberPoints(teamId, membershipId);
  }

  @Post(POINTS_ADJUSTMENT_ROUTE)
  @RequirePermissions(Permission.PointsAdjust)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a manual points adjustment' })
  @ApiCreatedResponse({ type: PointsSummaryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  adjustPoints(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PointsSummaryResponseDto> {
    return this.adjust.execute(actor, teamId, membershipId, {
      amount: dto.amount,
      reason: dto.reason,
      operationKey: dto.operationKey,
    });
  }
}
