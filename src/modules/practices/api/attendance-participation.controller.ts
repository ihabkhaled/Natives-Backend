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
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ParticipationQueryService } from '../application/participation-query.service';
import {
  PARTICIPATION_ROUTE,
  PARTICIPATION_SELF_ROUTE,
} from '../model/attendance.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { MEMBERSHIP_ID_PARAM } from '../model/rsvp.constants';
import { ParticipationQueryDto } from './dto/participation.query.dto';
import { ParticipationResponseDto } from './dto/participation-response.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class AttendanceParticipationController {
  constructor(private readonly participation: ParticipationQueryService) {}

  @Get(PARTICIPATION_SELF_ROUTE)
  @RequirePermissions(Permission.AttendanceReadSelf)
  @ApiOperation({
    summary: 'My attendance participation inputs (scoring inputs)',
  })
  @ApiOkResponse({ description: 'Inputs', type: ParticipationResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMyParticipation(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ParticipationQueryDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<ParticipationResponseDto> {
    return this.participation.getOwn(teamId, actor, query.seasonId ?? null);
  }

  @Get(PARTICIPATION_ROUTE)
  @RequirePermissions(Permission.AttendanceReadTeam)
  @ApiOperation({ summary: "A member's attendance participation inputs" })
  @ApiOkResponse({ description: 'Inputs', type: ParticipationResponseDto })
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
