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

import { CompleteMatchPointUseCase } from '../application/complete-match-point.use-case';
import { CorrectMatchPlayUseCase } from '../application/correct-match-play.use-case';
import { MatchPlayQueryService } from '../application/match-play-query.service';
import { RecordMatchPlayUseCase } from '../application/record-match-play.use-case';
import { StartMatchPointUseCase } from '../application/start-match-point.use-case';
import { resolvePlaysPage } from '../lib/matches.helpers';
import {
  toCompletePointContent,
  toCorrectionContent,
  toPlayContent,
  toStartPointContent,
} from '../lib/matches-command.mapper';
import {
  MATCH_ID_PARAM,
  MATCH_POINTS_ROUTE,
  MATCHES_API_TAG,
  POINT_COMPLETION_ROUTE,
  POINT_CORRECTIONS_ROUTE,
  POINT_PLAYS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/matches.constants';
import { CompleteMatchPointDto } from './dto/complete-match-point.dto';
import { CorrectMatchPlayDto } from './dto/correct-match-play.dto';
import { ListMatchPlaysResponseDto } from './dto/list-match-plays.response.dto';
import { MatchPlayOperationResponseDto } from './dto/match-play-operation.response.dto';
import { MatchPlayPageQueryDto } from './dto/match-play-page.query.dto';
import { RecordMatchPlayDto } from './dto/record-match-play.dto';
import { StartMatchPointDto } from './dto/start-match-point.dto';

/**
 * HTTP surface for point lineups and possession events (UN-504): opening a point
 * with the line that took the field, recording possession facts inside it,
 * closing it with the scoring side, retracting a mistake with a compensating
 * correction (all match.score), and reading the whole recorded stream
 * (match.read).
 *
 * Every write is keyed on the caller's client operation id, so an offline
 * scorekeeper's queued replay is safe to retry: the same id returns the same
 * authoritative outcome, and the same id with a different payload is a 409.
 */
@ApiTags(MATCHES_API_TAG)
@Controller(MATCH_POINTS_ROUTE)
export class MatchPointsController {
  constructor(
    private readonly query: MatchPlayQueryService,
    private readonly startPoint: StartMatchPointUseCase,
    private readonly completePoint: CompleteMatchPointUseCase,
    private readonly recordPlay: RecordMatchPlayUseCase,
    private readonly correctPlay: CorrectMatchPlayUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'List the append-only point stream of a match' })
  @ApiOkResponse({ type: ListMatchPlaysResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Query() query: MatchPlayPageQueryDto,
  ): Promise<ListMatchPlaysResponseDto> {
    return this.query.listForMatch(
      teamId,
      matchId,
      resolvePlaysPage(query.limit, query.offset),
    );
  }

  @Post()
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a point by recording the line on the field' })
  @ApiCreatedResponse({ type: MatchPlayOperationResponseDto })
  @ApiConflictResponse({
    description: 'A point is already open, or a conflict',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  start(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: StartMatchPointDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchPlayOperationResponseDto> {
    return this.startPoint.execute(actor, teamId, matchId, {
      content: toStartPointContent(dto),
    });
  }

  @Post(POINT_COMPLETION_ROUTE)
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Close the open point with the scoring side' })
  @ApiCreatedResponse({ type: MatchPlayOperationResponseDto })
  @ApiConflictResponse({ description: 'No point is open, or a conflict' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  complete(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: CompleteMatchPointDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchPlayOperationResponseDto> {
    return this.completePoint.execute(actor, teamId, matchId, {
      content: toCompletePointContent(dto),
    });
  }

  @Post(POINT_PLAYS_ROUTE)
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record one possession fact inside the open point' })
  @ApiCreatedResponse({ type: MatchPlayOperationResponseDto })
  @ApiConflictResponse({ description: 'No point is open, or a conflict' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  play(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: RecordMatchPlayDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchPlayOperationResponseDto> {
    return this.recordPlay.execute(actor, teamId, matchId, {
      content: toPlayContent(dto),
    });
  }

  @Post(POINT_CORRECTIONS_ROUTE)
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retract a recorded fact with a correction' })
  @ApiCreatedResponse({ type: MatchPlayOperationResponseDto })
  @ApiConflictResponse({ description: 'Already retracted, or match not live' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  correct(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: CorrectMatchPlayDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchPlayOperationResponseDto> {
    return this.correctPlay.execute(actor, teamId, matchId, {
      content: toCorrectionContent(dto),
    });
  }
}
