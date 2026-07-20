import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
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

import { CreateMatchUseCase } from '../application/create-match.use-case';
import { FinalizeMatchUseCase } from '../application/finalize-match.use-case';
import { MatchQueryService } from '../application/match-query.service';
import { MatchRevisionQueryService } from '../application/match-revision-query.service';
import { MatchScoreboardService } from '../application/match-scoreboard.service';
import { ReopenMatchUseCase } from '../application/reopen-match.use-case';
import { TransitionMatchUseCase } from '../application/transition-match.use-case';
import { resolveEventsPage, resolveMatchesPage } from '../lib/matches.helpers';
import {
  toMatchContent,
  toMatchListFilter,
} from '../lib/matches-command.mapper';
import {
  MATCH_FINALIZE_ROUTE,
  MATCH_ID_PARAM,
  MATCH_ITEM_ROUTE,
  MATCH_REOPEN_ROUTE,
  MATCH_REVISIONS_ROUTE,
  MATCH_SCOREBOARD_ROUTE,
  MATCH_TRANSITION_ROUTE,
  MATCHES_API_TAG,
  MATCHES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/matches.constants';
import { CreateMatchDto } from './dto/create-match.dto';
import { FinalizeMatchDto } from './dto/finalize-match.dto';
import { ListMatchRevisionsResponseDto } from './dto/list-match-revisions.response.dto';
import { ListMatchesResponseDto } from './dto/list-matches.response.dto';
import { MatchListQueryDto } from './dto/match-list.query.dto';
import { MatchPageQueryDto } from './dto/match-page.query.dto';
import { MatchResponseDto } from './dto/match-response.dto';
import { MatchScoreboardResponseDto } from './dto/match-scoreboard.response.dto';
import { ReopenMatchDto } from './dto/reopen-match.dto';
import { TransitionMatchDto } from './dto/transition-match.dto';

/**
 * HTTP surface for match lifecycle and results: bounded reads, the live
 * scoreboard, and the correction trail (match.read); creating a match and driving
 * the plain lifecycle (match.manage); publishing the authoritative result
 * (match.finalize); and reopening a finalized match for correction
 * (match.correct). Those last two are separate routes precisely so they can carry
 * the higher permissions. Identity comes from the token; the team scope is
 * enforced by the permissions guard and the application.
 */
@ApiTags(MATCHES_API_TAG)
@Controller(MATCHES_ROUTE)
export class MatchesController {
  constructor(
    private readonly query: MatchQueryService,
    private readonly scoreboard: MatchScoreboardService,
    private readonly revisions: MatchRevisionQueryService,
    private readonly createMatch: CreateMatchUseCase,
    private readonly transitionMatch: TransitionMatchUseCase,
    private readonly finalizeMatch: FinalizeMatchUseCase,
    private readonly reopenMatch: ReopenMatchUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'List a team’s matches' })
  @ApiOkResponse({ type: ListMatchesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: MatchListQueryDto,
  ): Promise<ListMatchesResponseDto> {
    return this.query.listForScope(
      teamId,
      toMatchListFilter(query),
      resolveMatchesPage(query.limit, query.offset),
    );
  }

  @Get(MATCH_ITEM_ROUTE)
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'Get one match' })
  @ApiOkResponse({ type: MatchResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
  ): Promise<MatchResponseDto> {
    return this.query.getById(teamId, matchId);
  }

  @Get(MATCH_SCOREBOARD_ROUTE)
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'Project the live scoreboard, caps, and timeouts' })
  @ApiOkResponse({ type: MatchScoreboardResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  scoreboardFor(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
  ): Promise<MatchScoreboardResponseDto> {
    return this.scoreboard.getForMatch(teamId, matchId);
  }

  @Get(MATCH_REVISIONS_ROUTE)
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'List the immutable correction trail of a match' })
  @ApiOkResponse({ type: ListMatchRevisionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listRevisions(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Query() query: MatchPageQueryDto,
  ): Promise<ListMatchRevisionsResponseDto> {
    return this.revisions.listForMatch(
      teamId,
      matchId,
      resolveEventsPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.MatchManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the match record for a fixture' })
  @ApiCreatedResponse({ type: MatchResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateMatchDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchResponseDto> {
    return this.createMatch.execute(actor, teamId, {
      content: toMatchContent(dto),
    });
  }

  @Post(MATCH_TRANSITION_ROUTE)
  @RequirePermissions(Permission.MatchManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ready, start, pause, resume, halftime, complete, or abandon',
  })
  @ApiOkResponse({ type: MatchResponseDto })
  @ApiConflictResponse({ description: 'Invalid transition or stale version' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: TransitionMatchDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchResponseDto> {
    return this.transitionMatch.execute(actor, teamId, matchId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
      reason: dto.reason ?? null,
    });
  }

  @Post(MATCH_FINALIZE_ROUTE)
  @RequirePermissions(Permission.MatchFinalize)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish the authoritative result of a match' })
  @ApiOkResponse({ type: MatchResponseDto })
  @ApiConflictResponse({
    description: 'Conflicting or already published score',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  finalize(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: FinalizeMatchDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchResponseDto> {
    return this.finalizeMatch.execute(actor, teamId, matchId, {
      expectedRecordVersion: dto.expectedRecordVersion,
      ourScore: dto.ourScore ?? null,
      opponentScore: dto.opponentScore ?? null,
    });
  }

  @Post(MATCH_REOPEN_ROUTE)
  @RequirePermissions(Permission.MatchCorrect)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reopen a finalized match for an audited correction',
  })
  @ApiOkResponse({ type: MatchResponseDto })
  @ApiConflictResponse({ description: 'The match is not finalized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reopen(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: ReopenMatchDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchResponseDto> {
    return this.reopenMatch.execute(actor, teamId, matchId, {
      reason: dto.reason,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
