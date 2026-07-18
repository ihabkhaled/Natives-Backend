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
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AgendaAdminService } from '../application/agenda-admin.service';
import { AgendaQueryService } from '../application/agenda-query.service';
import { CompleteAgendaUseCase } from '../application/complete-agenda.use-case';
import { CopyAgendaUseCase } from '../application/copy-agenda.use-case';
import { PublishAgendaUseCase } from '../application/publish-agenda.use-case';
import {
  AGENDA_COMPLETE_ROUTE,
  AGENDA_COPY_ROUTE,
  AGENDA_PLAN_ROUTE,
  AGENDA_PUBLISH_ROUTE,
  AGENDA_ROUTE,
} from '../model/agendas.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { AgendaResponseDto } from './dto/agenda-response.dto';
import { AgendaSummaryResponseDto } from './dto/agenda-summary-response.dto';
import { AgendaVersionDto } from './dto/agenda-version.dto';
import { CopyAgendaDto } from './dto/copy-agenda.dto';
import { CreateAgendaDto } from './dto/create-agenda.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class PracticeAgendaController {
  constructor(
    private readonly query: AgendaQueryService,
    private readonly admin: AgendaAdminService,
    private readonly copy: CopyAgendaUseCase,
    private readonly publish: PublishAgendaUseCase,
    private readonly complete: CompleteAgendaUseCase,
  ) {}

  @Get(AGENDA_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Get the session agenda (no private coach notes)' })
  @ApiOkResponse({ description: 'Agenda', type: AgendaResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getAgenda(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<AgendaResponseDto> {
    return this.query.getAgenda(teamId, sessionId);
  }

  @Get(AGENDA_PLAN_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({
    summary: 'Get the coach plan (includes private coach notes)',
  })
  @ApiOkResponse({ description: 'Agenda plan', type: AgendaResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getAgendaPlan(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<AgendaResponseDto> {
    return this.query.getAgendaPlan(teamId, sessionId);
  }

  @Post(AGENDA_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Create (ensure) the session draft agenda' })
  @ApiOkResponse({ description: 'Agenda', type: AgendaSummaryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createAgenda(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: CreateAgendaDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AgendaSummaryResponseDto> {
    return this.admin.createAgenda(actor, teamId, sessionId, {
      theme: dto.theme ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Post(AGENDA_COPY_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({
    summary: 'Copy a plan from another session into this agenda',
  })
  @ApiOkResponse({ description: 'Copied', type: AgendaSummaryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  copyAgenda(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: CopyAgendaDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AgendaSummaryResponseDto> {
    return this.copy.execute(actor, teamId, sessionId, {
      sourceSessionId: dto.sourceSessionId,
    });
  }

  @Post(AGENDA_PUBLISH_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Publish (lock the structure of) the agenda' })
  @ApiOkResponse({ description: 'Published', type: AgendaSummaryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publishAgenda(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: AgendaVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AgendaSummaryResponseDto> {
    return this.publish.execute(actor, teamId, sessionId, {
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Post(AGENDA_COMPLETE_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Complete the agenda (post-session review)' })
  @ApiOkResponse({ description: 'Completed', type: AgendaSummaryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  completeAgenda(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: AgendaVersionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AgendaSummaryResponseDto> {
    return this.complete.execute(actor, teamId, sessionId, {
      expectedVersion: dto.expectedVersion ?? null,
    });
  }
}
