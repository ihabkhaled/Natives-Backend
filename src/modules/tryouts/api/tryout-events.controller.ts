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

import { ManageTryoutEventUseCase } from '../application/manage-tryout-event.use-case';
import { TryoutFunnelService } from '../application/tryout-funnel.service';
import { TryoutQueryService } from '../application/tryout-query.service';
import { resolveTryoutsPage } from '../lib/tryouts.helpers';
import { toTryoutEventContent } from '../lib/tryouts-command.mapper';
import {
  EVENT_FUNNEL_ROUTE,
  EVENT_ID_PARAM,
  EVENT_ITEM_ROUTE,
  EVENT_TRANSITION_ROUTE,
  TEAM_ID_PARAM,
  TRYOUT_EVENTS_ROUTE,
  TRYOUTS_API_TAG,
} from '../model/tryouts.constants';
import {
  CreateTryoutEventDto,
  ListTryoutEventsResponseDto,
  TransitionTryoutEventDto,
  TryoutEventResponseDto,
  TryoutFunnelResponseDto,
  TryoutPageQueryDto,
} from './dto/tryouts.dto';

/**
 * HTTP surface for tryout events: bounded reads and the privacy-safe funnel
 * report (tryout.manage), plus creating an event and moving it through its
 * lifecycle. Registration only becomes possible once the event is explicitly
 * opened.
 */
@ApiTags(TRYOUTS_API_TAG)
@Controller(TRYOUT_EVENTS_ROUTE)
export class TryoutEventsController {
  constructor(
    private readonly query: TryoutQueryService,
    private readonly funnel: TryoutFunnelService,
    private readonly events: ManageTryoutEventUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.TryoutManage)
  @ApiOperation({ summary: 'List a team’s tryout events' })
  @ApiOkResponse({ type: ListTryoutEventsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: TryoutPageQueryDto,
  ): Promise<ListTryoutEventsResponseDto> {
    return this.query.listEvents(
      teamId,
      resolveTryoutsPage(query.limit, query.offset),
    );
  }

  @Get(EVENT_ITEM_ROUTE)
  @RequirePermissions(Permission.TryoutManage)
  @ApiOperation({ summary: 'Get one tryout event' })
  @ApiOkResponse({ type: TryoutEventResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(EVENT_ID_PARAM, UuidValidationPipe) eventId: string,
  ): Promise<TryoutEventResponseDto> {
    return this.query.getEvent(teamId, eventId);
  }

  @Get(EVENT_FUNNEL_ROUTE)
  @RequirePermissions(Permission.TryoutManage)
  @ApiOperation({ summary: 'Read the privacy-safe tryout funnel' })
  @ApiOkResponse({ type: TryoutFunnelResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  readFunnel(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(EVENT_ID_PARAM, UuidValidationPipe) eventId: string,
  ): Promise<TryoutFunnelResponseDto> {
    return this.funnel.forEvent(teamId, eventId);
  }

  @Post()
  @RequirePermissions(Permission.TryoutManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft tryout event' })
  @ApiCreatedResponse({ type: TryoutEventResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateTryoutEventDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutEventResponseDto> {
    return this.events.create(actor, teamId, {
      content: toTryoutEventContent(dto),
    });
  }

  @Post(EVENT_TRANSITION_ROUTE)
  @RequirePermissions(Permission.TryoutManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open, close, complete, or cancel a tryout event' })
  @ApiOkResponse({ type: TryoutEventResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(EVENT_ID_PARAM, UuidValidationPipe) eventId: string,
    @Body() dto: TransitionTryoutEventDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<TryoutEventResponseDto> {
    return this.events.transition(actor, teamId, eventId, {
      transition: dto.transition,
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
