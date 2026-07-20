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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { CreatePracticeSessionUseCase } from '../application/create-practice-session.use-case';
import { ReschedulePracticeSessionUseCase } from '../application/reschedule-practice-session.use-case';
import { SessionQueryService } from '../application/session-query.service';
import { TransitionPracticeSessionUseCase } from '../application/transition-practice-session.use-case';
import { UpdatePracticeSessionUseCase } from '../application/update-practice-session.use-case';
import { resolveSessionFilter } from '../lib/practices.helpers';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_BY_ID_ROUTE,
  SESSION_CANCEL_ROUTE,
  SESSION_HISTORY_ROUTE,
  SESSION_ID_PARAM,
  SESSION_PUBLISH_ROUTE,
  SESSION_REOPEN_ROUTE,
  SESSION_RESCHEDULE_ROUTE,
  SESSIONS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { SessionStatus } from '../model/practices.enums';
import { CreatePracticeSessionDto } from './dto/create-session.dto';
import { ListSessionsQueryDto } from './dto/list-sessions.query.dto';
import { ListSessionsResponseDto } from './dto/list-sessions-response.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';
import { SessionHistoryResponseDto } from './dto/session-history-response.dto';
import { PracticeSessionResponseDto } from './dto/session-response.dto';
import { SessionStatusDto } from './dto/session-status.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class PracticeSessionsController {
  constructor(
    private readonly createSession: CreatePracticeSessionUseCase,
    private readonly updateSession: UpdatePracticeSessionUseCase,
    private readonly transitionSession: TransitionPracticeSessionUseCase,
    private readonly rescheduleSession: ReschedulePracticeSessionUseCase,
    private readonly sessionQuery: SessionQueryService,
  ) {}

  @Post(SESSIONS_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a one-off practice session' })
  @ApiCreatedResponse({
    description: 'Session created',
    type: PracticeSessionResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreatePracticeSessionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PracticeSessionResponseDto> {
    return this.createSession.execute(actor, teamId, {
      seasonId: dto.seasonId ?? null,
      sessionType: dto.sessionType,
      timezone: dto.timezone ?? null,
      venueId: dto.venueId ?? null,
      field: dto.field ?? null,
      capacity: dto.capacity ?? null,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      meetAt: dto.meetAt ?? null,
      rsvpCutoffAt: dto.rsvpCutoffAt ?? null,
      visibility: dto.visibility ?? null,
      organizerUserId: dto.organizerUserId ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Get(SESSIONS_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'List/calendar practice sessions for a team' })
  @ApiOkResponse({ description: 'Sessions', type: ListSessionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListSessionsQueryDto,
  ): Promise<ListSessionsResponseDto> {
    return this.sessionQuery.listSessions(teamId, resolveSessionFilter(query));
  }

  @Get(SESSION_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Get a practice session' })
  @ApiOkResponse({ description: 'Session', type: PracticeSessionResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<PracticeSessionResponseDto> {
    return this.sessionQuery.getSession(teamId, sessionId);
  }

  @Get(SESSION_HISTORY_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Get a session status history' })
  @ApiOkResponse({ description: 'History', type: SessionHistoryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  history(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<SessionHistoryResponseDto> {
    return this.sessionQuery.listHistory(teamId, sessionId);
  }

  @Patch(SESSION_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Update session details' })
  @ApiOkResponse({
    description: 'Session updated',
    type: PracticeSessionResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PracticeSessionResponseDto> {
    return this.updateSession.execute(actor, teamId, sessionId, {
      venueId: dto.venueId ?? null,
      field: dto.field ?? null,
      capacity: dto.capacity ?? null,
      notes: dto.notes ?? null,
      visibility: dto.visibility,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(SESSION_PUBLISH_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Publish a session' })
  @ApiOkResponse({
    description: 'Session published',
    type: PracticeSessionResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: SessionStatusDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PracticeSessionResponseDto> {
    return this.transitionSession.execute(
      actor,
      teamId,
      sessionId,
      SessionStatus.Published,
      { reason: null, expectedVersion: dto.expectedVersion },
    );
  }

  @Post(SESSION_RESCHEDULE_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Reschedule a session' })
  @ApiOkResponse({
    description: 'Session rescheduled',
    type: PracticeSessionResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reschedule(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: RescheduleSessionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PracticeSessionResponseDto> {
    return this.rescheduleSession.execute(actor, teamId, sessionId, {
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      meetAt: dto.meetAt ?? null,
      rsvpCutoffAt: dto.rsvpCutoffAt ?? null,
      venueId: dto.venueId ?? null,
      field: dto.field ?? null,
      reason: dto.reason ?? null,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(SESSION_CANCEL_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Cancel a session (keeps RSVP/attendance history)' })
  @ApiOkResponse({
    description: 'Session cancelled',
    type: PracticeSessionResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  cancel(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: SessionStatusDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PracticeSessionResponseDto> {
    return this.transitionSession.execute(
      actor,
      teamId,
      sessionId,
      SessionStatus.Cancelled,
      { reason: dto.reason ?? null, expectedVersion: dto.expectedVersion },
    );
  }

  @Post(SESSION_REOPEN_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Re-open a cancelled session' })
  @ApiOkResponse({
    description: 'Session re-opened',
    type: PracticeSessionResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reopen(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: SessionStatusDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<PracticeSessionResponseDto> {
    return this.transitionSession.execute(
      actor,
      teamId,
      sessionId,
      SessionStatus.Published,
      { reason: dto.reason ?? null, expectedVersion: dto.expectedVersion },
    );
  }
}
