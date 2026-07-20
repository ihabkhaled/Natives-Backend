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

import { CreateMeasurementSessionUseCase } from '../application/create-measurement-session.use-case';
import { RecordMeasurementUseCase } from '../application/record-measurement.use-case';
import { SessionQueryService } from '../application/session-query.service';
import { TransitionMeasurementSessionUseCase } from '../application/transition-measurement-session.use-case';
import { resolveMeasurementsPage } from '../lib/measurements.helpers';
import {
  toAttemptInputs,
  toSessionContent,
} from '../lib/measurements-command.mapper';
import {
  MEASUREMENT_SESSIONS_ROUTE,
  MEASUREMENTS_API_TAG,
  SESSION_ATTEMPTS_ROUTE,
  SESSION_DETAIL_ROUTE,
  SESSION_ID_PARAM,
  SESSION_TRANSITION_ROUTE,
  TEAM_ID_PARAM,
} from '../model/measurements.constants';
import { CreateMeasurementSessionDto } from './dto/create-session.dto';
import { ListMeasurementsQueryDto } from './dto/list-measurements.query.dto';
import { ListSessionsResponseDto } from './dto/list-sessions.response.dto';
import { RecordMeasurementDto } from './dto/record-measurement.dto';
import { RecordedMeasurementResponseDto } from './dto/recorded-measurement.response.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';
import { MeasurementSessionResponseDto } from './dto/session-response.dto';
import { TransitionSessionDto } from './dto/transition-session.dto';

/**
 * The measurement-session surface. Reads are gated by analytics.read.team;
 * scheduling, conducting/cancelling, and recording attempts all require
 * measurement.record. Recording emits the MeasurementRecorded outbox event.
 */
@ApiTags(MEASUREMENTS_API_TAG)
@Controller(MEASUREMENT_SESSIONS_ROUTE)
export class MeasurementSessionController {
  constructor(
    private readonly query: SessionQueryService,
    private readonly createSession: CreateMeasurementSessionUseCase,
    private readonly transitionSession: TransitionMeasurementSessionUseCase,
    private readonly record: RecordMeasurementUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'List a team’s measurement sessions' })
  @ApiOkResponse({ type: ListSessionsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListMeasurementsQueryDto,
  ): Promise<ListSessionsResponseDto> {
    return this.query.listForTeam(
      teamId,
      resolveMeasurementsPage(query.limit, query.offset),
    );
  }

  @Get(SESSION_DETAIL_ROUTE)
  @RequirePermissions(Permission.AnalyticsReadTeam)
  @ApiOperation({ summary: 'Read one measurement session with its attempts' })
  @ApiOkResponse({ type: SessionDetailResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  detail(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<SessionDetailResponseDto> {
    return this.query.getDetail(teamId, sessionId);
  }

  @Post()
  @RequirePermissions(Permission.MeasurementRecord)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a measurement session' })
  @ApiCreatedResponse({ type: MeasurementSessionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateMeasurementSessionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MeasurementSessionResponseDto> {
    return this.createSession.execute(actor, teamId, {
      content: toSessionContent(dto),
    });
  }

  @Post(SESSION_TRANSITION_ROUTE)
  @RequirePermissions(Permission.MeasurementRecord)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conduct or cancel a measurement session' })
  @ApiOkResponse({ type: MeasurementSessionResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: TransitionSessionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MeasurementSessionResponseDto> {
    return this.transitionSession.execute(actor, teamId, sessionId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }

  @Post(SESSION_ATTEMPTS_ROUTE)
  @RequirePermissions(Permission.MeasurementRecord)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a player’s attempts for a protocol' })
  @ApiCreatedResponse({ type: RecordedMeasurementResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  recordAttempts(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: RecordMeasurementDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RecordedMeasurementResponseDto> {
    return this.record.execute(actor, teamId, sessionId, {
      membershipId: dto.membershipId,
      protocolId: dto.protocolId,
      attempts: toAttemptInputs(dto.attempts),
    });
  }
}
