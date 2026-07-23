import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AttendanceSelfHistoryQueryService } from '../application/attendance-self-history.query.service';
import { ParticipationQueryService } from '../application/participation-query.service';
import { resolveSelfHistoryRequest } from '../lib/attendance.helpers';
import {
  ATTENDANCE_SELF_HISTORY_ROUTE,
  PARTICIPATION_ROUTE,
  PARTICIPATION_SELF_ROUTE,
} from '../model/attendance.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { MEMBERSHIP_ID_PARAM } from '../model/rsvp.constants';
import { AttendanceSelfHistoryQueryDto } from './dto/attendance-self-history.query.dto';
import { AttendanceSelfHistoryResponseDto } from './dto/attendance-self-history-response.dto';
import { ParticipationQueryDto } from './dto/participation.query.dto';
import { ParticipationResponseDto } from './dto/participation-response.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class AttendanceParticipationController {
  constructor(
    private readonly participation: ParticipationQueryService,
    private readonly selfHistory: AttendanceSelfHistoryQueryService,
  ) {}

  @Get(PARTICIPATION_SELF_ROUTE)
  @RequirePermissions(Permission.AttendanceReadSelf)
  @ApiOperation({
    summary: 'My attendance participation inputs (scoring inputs)',
    description:
      'Projects raw participation inputs from finalized attendance against ' +
      'the cited default rule version. When no default scoring rule is ' +
      'configured (a fresh database), responds 409 with messageKey ' +
      'errors.practices.attendanceRuleMissing — clients render "attendance ' +
      'scoring is not configured yet" and never retry.',
  })
  @ApiOkResponse({ description: 'Inputs', type: ParticipationResponseDto })
  @ApiConflictResponse({
    description:
      'No default attendance scoring rule is configured ' +
      '(errors.practices.attendanceRuleMissing)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMyParticipation(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ParticipationQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ParticipationResponseDto> {
    return this.participation.getOwn(teamId, actor, query.seasonId ?? null);
  }

  @Get(ATTENDANCE_SELF_HISTORY_ROUTE)
  @RequirePermissions(Permission.AttendanceReadSelf)
  @ApiOperation({
    summary: 'My own attendance history across sessions (paginated)',
    description:
      'Past (started, not cancelled) sessions of the team joined with the ' +
      'caller’s own attendance record, newest first. Rows without a ' +
      'record carry status null; sheetState null means no sheet exists yet. ' +
      'The membership is always resolved from the token.',
  })
  @ApiOkResponse({
    description: 'History',
    type: AttendanceSelfHistoryResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden (not an active member)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMyHistory(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: AttendanceSelfHistoryQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<AttendanceSelfHistoryResponseDto> {
    return this.selfHistory.getOwn(
      teamId,
      actor,
      resolveSelfHistoryRequest(query),
    );
  }

  @Get(PARTICIPATION_ROUTE)
  @RequirePermissions(Permission.AttendanceReadTeam)
  @ApiOperation({
    summary: "A member's attendance participation inputs",
    description:
      'Same projection as the self read, for staff. Responds 409 with ' +
      'messageKey errors.practices.attendanceRuleMissing when no default ' +
      'scoring rule is configured.',
  })
  @ApiOkResponse({ description: 'Inputs', type: ParticipationResponseDto })
  @ApiConflictResponse({
    description:
      'No default attendance scoring rule is configured ' +
      '(errors.practices.attendanceRuleMissing)',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMemberParticipation(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Query() query: ParticipationQueryDto,
  ): Promise<ParticipationResponseDto> {
    return this.participation.getForMember(
      teamId,
      membershipId,
      query.seasonId ?? null,
    );
  }
}
