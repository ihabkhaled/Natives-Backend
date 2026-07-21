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
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ArchivePracticeScheduleUseCase } from '../application/archive-practice-schedule.use-case';
import { CreatePracticeScheduleUseCase } from '../application/create-practice-schedule.use-case';
import { GenerateSessionsUseCase } from '../application/generate-sessions.use-case';
import { ScheduleQueryService } from '../application/schedule-query.service';
import { UpdatePracticeScheduleUseCase } from '../application/update-practice-schedule.use-case';
import { resolvePage } from '../lib/practices.helpers';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SCHEDULE_BY_ID_ROUTE,
  SCHEDULE_GENERATE_ROUTE,
  SCHEDULE_ID_PARAM,
  SCHEDULES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GenerationResultResponseDto } from './dto/generation-result-response.dto';
import { PracticeListQueryDto } from './dto/list-query.dto';
import { ListSchedulesResponseDto } from './dto/list-schedules-response.dto';
import { ScheduleResponseDto } from './dto/schedule-response.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class PracticeSchedulesController {
  constructor(
    private readonly createSchedule: CreatePracticeScheduleUseCase,
    private readonly updateSchedule: UpdatePracticeScheduleUseCase,
    private readonly archiveSchedule: ArchivePracticeScheduleUseCase,
    private readonly generateSessions: GenerateSessionsUseCase,
    private readonly scheduleQuery: ScheduleQueryService,
  ) {}

  @Post(SCHEDULES_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a practice schedule template' })
  @ApiCreatedResponse({
    description: 'Schedule created',
    type: ScheduleResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScheduleResponseDto> {
    return this.createSchedule.execute(actor, teamId, {
      seasonId: dto.seasonId ?? null,
      name: dto.name,
      sessionType: dto.sessionType,
      timezone: dto.timezone ?? null,
      frequency: dto.frequency,
      intervalWeeks: dto.intervalWeeks ?? null,
      weekdays: dto.weekdays ?? [],
      startTimeLocal: dto.startTimeLocal,
      durationMinutes: dto.durationMinutes,
      meetOffsetMinutes: dto.meetOffsetMinutes ?? null,
      rsvpCutoffMinutes: dto.rsvpCutoffMinutes ?? null,
      defaultVenueId: dto.defaultVenueId ?? null,
      defaultField: dto.defaultField ?? null,
      defaultCapacity: dto.defaultCapacity ?? null,
      visibility: dto.visibility ?? null,
      organizerUserId: dto.organizerUserId ?? null,
      notes: dto.notes ?? null,
      generationStart: dto.generationStart,
      generationUntil: dto.generationUntil,
      exceptions: dto.exceptions ?? [],
    });
  }

  @Get(SCHEDULES_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'List practice schedules for a team' })
  @ApiOkResponse({ description: 'Schedules', type: ListSchedulesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: PracticeListQueryDto,
  ): Promise<ListSchedulesResponseDto> {
    return this.scheduleQuery.listSchedules(
      teamId,
      resolvePage(query.limit, query.offset),
    );
  }

  @Get(SCHEDULE_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Get a practice schedule' })
  @ApiOkResponse({ description: 'Schedule', type: ScheduleResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SCHEDULE_ID_PARAM, UuidValidationPipe) scheduleId: string,
  ): Promise<ScheduleResponseDto> {
    return this.scheduleQuery.getSchedule(teamId, scheduleId);
  }

  @Patch(SCHEDULE_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Update a practice schedule template' })
  @ApiOkResponse({ description: 'Schedule updated', type: ScheduleResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SCHEDULE_ID_PARAM, UuidValidationPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScheduleResponseDto> {
    return this.updateSchedule.execute(actor, teamId, scheduleId, {
      seasonId: dto.seasonId ?? null,
      name: dto.name,
      sessionType: dto.sessionType,
      timezone: dto.timezone ?? null,
      frequency: dto.frequency,
      intervalWeeks: dto.intervalWeeks ?? null,
      weekdays: dto.weekdays ?? [],
      startTimeLocal: dto.startTimeLocal,
      durationMinutes: dto.durationMinutes,
      meetOffsetMinutes: dto.meetOffsetMinutes ?? null,
      rsvpCutoffMinutes: dto.rsvpCutoffMinutes ?? null,
      defaultVenueId: dto.defaultVenueId ?? null,
      defaultField: dto.defaultField ?? null,
      defaultCapacity: dto.defaultCapacity ?? null,
      visibility: dto.visibility ?? null,
      organizerUserId: dto.organizerUserId ?? null,
      notes: dto.notes ?? null,
      generationStart: dto.generationStart,
      generationUntil: dto.generationUntil,
      exceptions: dto.exceptions ?? [],
      status: dto.status,
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(SCHEDULE_GENERATE_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate sessions from a schedule (idempotent)' })
  @ApiCreatedResponse({
    description: 'Generation result',
    type: GenerationResultResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  generate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SCHEDULE_ID_PARAM, UuidValidationPipe) scheduleId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GenerationResultResponseDto> {
    return this.generateSessions.execute(actor, teamId, scheduleId);
  }

  @Delete(SCHEDULE_BY_ID_ROUTE)
  @RequirePermissions(Permission.PracticeManage)
  @ApiOperation({ summary: 'Archive a practice schedule' })
  @ApiOkResponse({
    description: 'Schedule archived',
    type: ScheduleResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SCHEDULE_ID_PARAM, UuidValidationPipe) scheduleId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ScheduleResponseDto> {
    return this.archiveSchedule.execute(actor, teamId, scheduleId);
  }
}
