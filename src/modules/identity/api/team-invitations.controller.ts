import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Permission, Role } from '@shared/enums';

import { CreateInvitationUseCase } from '../application/create-invitation.use-case';
import {
  INVITATIONS_API_TAG,
  TEAM_ID_PARAM,
  TEAM_INVITATIONS_ROUTE,
} from '../model/identity.constants';
import { CreateTeamInvitationDto } from './dto/create-team-invitation.dto';
import { InvitationDeliveryResponseDto } from './dto/invitation-delivery-response.dto';

/**
 * Team-scoped invitations. The `:teamId` path param gives the permission guard
 * a team scope, so a Team Admin whose member.invite grant is team-scoped can
 * invite into their own team (a cross-team attempt fails the scoped check with
 * 403). The invitation records the team and the ceiling-validated team role,
 * and acceptance links the invited membership in that team and grants that
 * role there.
 */
@ApiTags(INVITATIONS_API_TAG)
@Controller(TEAM_INVITATIONS_ROUTE)
export class TeamInvitationsController {
  constructor(private readonly createInvitation: CreateInvitationUseCase) {}

  @Post()
  @RequirePermissions(Permission.MemberInvite)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new member into this team by email' })
  @ApiCreatedResponse({
    description:
      'Invitation created for this team; response carries the one-time token for manual link delivery (OD-002)',
    type: InvitationDeliveryResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden outside the team scope' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: CreateTeamInvitationDto,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<InvitationDeliveryResponseDto> {
    return this.createInvitation.execute({
      email: dto.email,
      role: Role.User,
      actor: user,
      teamId,
      teamRoleSlug: dto.teamRole ?? null,
    });
  }
}
