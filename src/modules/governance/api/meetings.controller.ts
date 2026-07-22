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

import { ManageMeetingUseCase } from '../application/manage-meeting.use-case';
import { MeetingQueryService } from '../application/meeting-query.service';
import { resolveGovernancePage } from '../lib/governance.helpers';
import {
  toDecisionList,
  toMeetingContent,
  toMeetingListFilter,
} from '../lib/governance-command.mapper';
import {
  GOVERNANCE_API_TAG,
  MEETING_ID_PARAM,
  MEETING_ITEM_ROUTE,
  MEETING_TRANSITION_ROUTE,
  MEETINGS_ROUTE,
  TEAM_ID_PARAM,
} from '../model/governance.constants';
import {
  CreateMeetingDto,
  GovernanceMeetingResponseDto,
  ListGovernanceMeetingsResponseDto,
  MeetingListQueryDto,
  TransitionMeetingDto,
} from './dto/governance.dto';

/**
 * HTTP surface for governance meetings (governance.read / governance.manage).
 * The application applies the visibility policy so board-confidential minutes
 * are withheld from a reader without the board tier.
 */
@ApiTags(GOVERNANCE_API_TAG)
@Controller(MEETINGS_ROUTE)
export class MeetingsController {
  constructor(
    private readonly query: MeetingQueryService,
    private readonly meetings: ManageMeetingUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.GovernanceRead)
  @ApiOperation({ summary: 'List governance meetings (visibility applied)' })
  @ApiOkResponse({ type: ListGovernanceMeetingsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: MeetingListQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ListGovernanceMeetingsResponseDto> {
    return this.query.listForScope(
      actor,
      teamId,
      toMeetingListFilter(query),
      resolveGovernancePage(query.limit, query.offset),
    );
  }

  @Get(MEETING_ITEM_ROUTE)
  @RequirePermissions(Permission.GovernanceRead)
  @ApiOperation({ summary: 'Get one governance meeting (visibility applied)' })
  @ApiOkResponse({ type: GovernanceMeetingResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEETING_ID_PARAM, UuidValidationPipe) meetingId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernanceMeetingResponseDto> {
    return this.query.getById(actor, teamId, meetingId);
  }

  @Post()
  @RequirePermissions(Permission.GovernanceManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a governance meeting' })
  @ApiCreatedResponse({ type: GovernanceMeetingResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateMeetingDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernanceMeetingResponseDto> {
    return this.meetings.create(actor, teamId, {
      content: toMeetingContent(dto),
    });
  }

  @Post(MEETING_TRANSITION_ROUTE)
  @RequirePermissions(Permission.GovernanceManage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hold, minute, approve, or cancel a meeting' })
  @ApiOkResponse({ type: GovernanceMeetingResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  transition(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEETING_ID_PARAM, UuidValidationPipe) meetingId: string,
    @Body() dto: TransitionMeetingDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GovernanceMeetingResponseDto> {
    return this.meetings.transition(actor, teamId, meetingId, {
      transition: dto.transition,
      minutes: dto.minutes ?? null,
      decisions: toDecisionList(dto.decisions),
      expectedRecordVersion: dto.expectedRecordVersion,
    });
  }
}
