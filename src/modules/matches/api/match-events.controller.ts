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

import { MatchEventQueryService } from '../application/match-event-query.service';
import { RecordMatchPointUseCase } from '../application/record-match-point.use-case';
import { RecordMatchTimeoutUseCase } from '../application/record-match-timeout.use-case';
import { VoidMatchEventUseCase } from '../application/void-match-event.use-case';
import { resolveEventsPage } from '../lib/matches.helpers';
import {
  toPointContent,
  toTimeoutContent,
} from '../lib/matches-command.mapper';
import {
  MATCH_EVENTS_ROUTE,
  MATCH_ID_PARAM,
  MATCH_POINT_ROUTE,
  MATCH_TIMEOUT_ROUTE,
  MATCH_VOID_ROUTE,
  MATCHES_API_TAG,
  TEAM_ID_PARAM,
} from '../model/matches.constants';
import { ListMatchEventsResponseDto } from './dto/list-match-events.response.dto';
import { MatchOperationResponseDto } from './dto/match-operation.response.dto';
import { MatchPageQueryDto } from './dto/match-page.query.dto';
import { RecordMatchPointDto } from './dto/record-match-point.dto';
import { RecordMatchTimeoutDto } from './dto/record-match-timeout.dto';
import { VoidMatchEventDto } from './dto/void-match-event.dto';

/**
 * HTTP surface for the append-only match stream: reading the whole recorded
 * history (match.read) and the three idempotent scoring operations — point,
 * timeout, and compensating void (match.score).
 *
 * Every write is keyed on the caller's client operation id, so an offline
 * scorekeeper's queued replay is safe to retry: the same id returns the same
 * authoritative outcome, and the same id with a different payload is a 409.
 */
@ApiTags(MATCHES_API_TAG)
@Controller(MATCH_EVENTS_ROUTE)
export class MatchEventsController {
  constructor(
    private readonly query: MatchEventQueryService,
    private readonly recordPoint: RecordMatchPointUseCase,
    private readonly recordTimeout: RecordMatchTimeoutUseCase,
    private readonly voidEvent: VoidMatchEventUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.MatchRead)
  @ApiOperation({ summary: 'List the append-only stream of a match' })
  @ApiOkResponse({ type: ListMatchEventsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Query() query: MatchPageQueryDto,
  ): Promise<ListMatchEventsResponseDto> {
    return this.query.listForMatch(
      teamId,
      matchId,
      resolveEventsPage(query.limit, query.offset),
    );
  }

  @Post(MATCH_POINT_ROUTE)
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record one point (idempotent on the operation id)',
  })
  @ApiCreatedResponse({ type: MatchOperationResponseDto })
  @ApiConflictResponse({ description: 'Operation or stream version conflict' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  point(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: RecordMatchPointDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchOperationResponseDto> {
    return this.recordPoint.execute(actor, teamId, matchId, {
      content: toPointContent(dto),
    });
  }

  @Post(MATCH_TIMEOUT_ROUTE)
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a timeout against the ruleset allowance' })
  @ApiCreatedResponse({ type: MatchOperationResponseDto })
  @ApiConflictResponse({ description: 'No timeouts remain in this period' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  timeout(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: RecordMatchTimeoutDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchOperationResponseDto> {
    return this.recordTimeout.execute(actor, teamId, matchId, {
      content: toTimeoutContent(dto),
    });
  }

  @Post(MATCH_VOID_ROUTE)
  @RequirePermissions(Permission.MatchScore)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Undo a recorded fact by appending a void' })
  @ApiCreatedResponse({ type: MatchOperationResponseDto })
  @ApiConflictResponse({ description: 'Already voided or match not live' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  voidFact(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MATCH_ID_PARAM, UuidValidationPipe) matchId: string,
    @Body() dto: VoidMatchEventDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MatchOperationResponseDto> {
    return this.voidEvent.execute(actor, teamId, matchId, {
      content: {
        operationId: dto.operationId,
        eventId: dto.eventId,
        reason: dto.reason,
      },
    });
  }
}
