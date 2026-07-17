import {
  type AuthUserIdentity,
  CurrentUser,
  Public,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiOkResponse,
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

import { AcceptInvitationUseCase } from '../application/accept-invitation.use-case';
import { CreateInvitationUseCase } from '../application/create-invitation.use-case';
import { ResendInvitationUseCase } from '../application/resend-invitation.use-case';
import { RevokeInvitationUseCase } from '../application/revoke-invitation.use-case';
import {
  INVITATION_ID_PARAM,
  INVITATIONS_ACCEPT_ROUTE,
  INVITATIONS_API_TAG,
  INVITATIONS_RESEND_ROUTE,
  INVITATIONS_REVOKE_ROUTE,
  INVITATIONS_ROUTE,
} from '../model/identity.constants';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { SessionResponseDto } from './dto/session-response.dto';

@ApiTags(INVITATIONS_API_TAG)
@Controller(INVITATIONS_ROUTE)
export class InvitationsController {
  constructor(
    private readonly createInvitation: CreateInvitationUseCase,
    private readonly resendInvitation: ResendInvitationUseCase,
    private readonly revokeInvitation: RevokeInvitationUseCase,
    private readonly acceptInvitation: AcceptInvitationUseCase,
  ) {}

  @Post()
  @RequirePermissions(Permission.InvitationCreate)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new member' })
  @ApiCreatedResponse({
    description: 'Invitation created',
    type: InvitationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<InvitationResponseDto> {
    return this.createInvitation.execute({
      email: dto.email,
      role: dto.role ?? Role.User,
      invitedBy: user.userId,
    });
  }

  @Post(INVITATIONS_RESEND_ROUTE)
  @RequirePermissions(Permission.InvitationCreate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a pending invitation' })
  @ApiOkResponse({
    description: 'Invitation resent',
    type: InvitationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  resend(
    @Param(INVITATION_ID_PARAM, UuidValidationPipe) id: string,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<InvitationResponseDto> {
    return this.resendInvitation.execute(id, user.userId);
  }

  @Post(INVITATIONS_REVOKE_ROUTE)
  @RequirePermissions(Permission.InvitationRevoke)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  @ApiOkResponse({
    description: 'Invitation revoked',
    type: InvitationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revoke(
    @Param(INVITATION_ID_PARAM, UuidValidationPipe) id: string,
    @CurrentUser() user: AuthUserIdentity,
  ): Promise<InvitationResponseDto> {
    return this.revokeInvitation.execute(id, user.userId);
  }

  @Public()
  @Post(INVITATIONS_ACCEPT_ROUTE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept an invitation and set a password' })
  @ApiCreatedResponse({
    description: 'Account activated and session issued',
    type: SessionResponseDto,
  })
  accept(@Body() dto: AcceptInvitationDto): Promise<SessionResponseDto> {
    return this.acceptInvitation.execute({
      token: dto.token,
      password: dto.password,
      displayName: dto.displayName ?? null,
      deviceLabel: dto.deviceLabel ?? null,
    });
  }
}
