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
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { OverrideRsvpUseCase } from '../application/override-rsvp.use-case';
import { RsvpQueryService } from '../application/rsvp-query.service';
import { SetOwnRsvpUseCase } from '../application/set-own-rsvp.use-case';
import { resolveRsvpFilter } from '../lib/rsvp.helpers';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import {
  MEMBERSHIP_ID_PARAM,
  RSVP_HISTORY_ROUTE,
  RSVP_LIST_ROUTE,
  RSVP_OVERRIDE_ROUTE,
  RSVP_SELF_ROUTE,
  RSVP_SUMMARY_ROUTE,
} from '../model/rsvp.constants';
import { ListRsvpsQueryDto } from './dto/list-rsvps.query.dto';
import { ListRsvpsResponseDto } from './dto/list-rsvps-response.dto';
import { OverrideRsvpDto } from './dto/override-rsvp.dto';
import { RsvpHistoryResponseDto } from './dto/rsvp-history-response.dto';
import { RsvpResponseDto } from './dto/rsvp-response.dto';
import { RsvpSummaryResponseDto } from './dto/rsvp-summary-response.dto';
import { SetRsvpDto } from './dto/set-rsvp.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class PracticeRsvpController {
  constructor(
    private readonly setOwn: SetOwnRsvpUseCase,
    private readonly override: OverrideRsvpUseCase,
    private readonly query: RsvpQueryService,
  ) {}

  @Put(RSVP_SELF_ROUTE)
  @RequirePermissions(Permission.PracticeRsvpSelf)
  @ApiOperation({ summary: 'Set or change my own availability for a session' })
  @ApiOkResponse({ description: 'RSVP recorded', type: RsvpResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  setMyRsvp(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: SetRsvpDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RsvpResponseDto> {
    return this.setOwn.execute(actor, teamId, sessionId, {
      status: dto.status,
      reasonCategory: dto.reasonCategory ?? null,
      note: dto.note ?? null,
      noteVisibility: dto.noteVisibility ?? null,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Get(RSVP_SELF_ROUTE)
  @RequirePermissions(Permission.PracticeRsvpSelf)
  @ApiOperation({ summary: 'Get my own availability for a session' })
  @ApiOkResponse({ description: 'My RSVP', type: RsvpResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMyRsvp(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RsvpResponseDto> {
    return this.query.getOwnRsvp(teamId, sessionId, actor);
  }

  @Get(RSVP_LIST_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'List RSVP participants for a session' })
  @ApiOkResponse({ description: 'Participants', type: ListRsvpsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listParticipants(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Query() query: ListRsvpsQueryDto,
  ): Promise<ListRsvpsResponseDto> {
    return this.query.listParticipants(
      teamId,
      sessionId,
      resolveRsvpFilter(query),
    );
  }

  @Get(RSVP_SUMMARY_ROUTE)
  @RequirePermissions(Permission.PracticeRead)
  @ApiOperation({ summary: 'Privacy-safe RSVP planning summary for a session' })
  @ApiOkResponse({ description: 'Summary', type: RsvpSummaryResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getSummary(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
  ): Promise<RsvpSummaryResponseDto> {
    return this.query.getSummary(teamId, sessionId);
  }

  @Put(RSVP_OVERRIDE_ROUTE)
  @RequirePermissions(Permission.PracticeRsvpOverride)
  @ApiOperation({ summary: "Override a member's availability (coach/admin)" })
  @ApiOkResponse({ description: 'RSVP overridden', type: RsvpResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  overrideRsvp(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: OverrideRsvpDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RsvpResponseDto> {
    return this.override.execute(actor, teamId, sessionId, membershipId, {
      status: dto.status,
      reasonCategory: dto.reasonCategory ?? null,
      note: dto.note ?? null,
      noteVisibility: dto.noteVisibility ?? null,
      overrideReason: dto.reason,
      expectedVersion: dto.expectedVersion ?? null,
    });
  }

  @Get(RSVP_HISTORY_ROUTE)
  @RequirePermissions(Permission.PracticeRsvpOverride)
  @ApiOperation({ summary: "A member's RSVP revision history (coach/admin)" })
  @ApiOkResponse({ description: 'History', type: RsvpHistoryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getHistory(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<RsvpHistoryResponseDto> {
    return this.query.getHistory(teamId, sessionId, membershipId);
  }
}
