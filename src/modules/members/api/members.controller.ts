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
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AnonymizeMemberUseCase } from '../application/anonymize-member.use-case';
import { InviteMemberUseCase } from '../application/invite-member.use-case';
import { MemberDirectoryService } from '../application/member-directory.service';
import { MemberHistoryService } from '../application/member-history.service';
import { MemberViewService } from '../application/member-view.service';
import { TransitionMemberUseCase } from '../application/transition-member.use-case';
import { UpdateMemberProfileUseCase } from '../application/update-member-profile.use-case';
import { resolvePage } from '../lib/members.helpers';
import { toProfileInput } from '../lib/profile-input.mapper';
import {
  MEMBER_ACTIVATE_ROUTE,
  MEMBER_ANONYMIZE_ROUTE,
  MEMBER_ARCHIVE_ROUTE,
  MEMBER_BY_ID_ROUTE,
  MEMBER_DEACTIVATE_ROUTE,
  MEMBER_HISTORY_ROUTE,
  MEMBER_INVITE_ROUTE,
  MEMBER_LEAVE_ROUTE,
  MEMBER_PROFILE_ROUTE,
  MEMBER_SUSPEND_ROUTE,
  MEMBERS_API_TAG,
  MEMBERS_ROUTE,
  MEMBERSHIP_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/members.constants';
import { MembershipStatus } from '../model/members.enums';
import { InviteMemberDto } from './dto/invite-member.dto';
import { ListMembersQueryDto } from './dto/list-members.query.dto';
import { ListMembersResponseDto } from './dto/member-directory-response.dto';
import { MemberHistoryResponseDto } from './dto/member-history-response.dto';
import { MemberViewResponseDto } from './dto/member-view-response.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { TransitionDto } from './dto/transition.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags(MEMBERS_API_TAG)
@Controller(MEMBERS_ROUTE)
export class MembersController {
  constructor(
    private readonly inviteMember: InviteMemberUseCase,
    private readonly directory: MemberDirectoryService,
    private readonly memberView: MemberViewService,
    private readonly updateProfile: UpdateMemberProfileUseCase,
    private readonly transitionMember: TransitionMemberUseCase,
    private readonly anonymizeMember: AnonymizeMemberUseCase,
    private readonly history: MemberHistoryService,
  ) {}

  @Post(MEMBER_INVITE_ROUTE)
  @RequirePermissions(Permission.MemberInvite)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a person into a team' })
  @ApiCreatedResponse({
    description: 'Member invited',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  invite(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.inviteMember.execute(actor, teamId, {
      userId: dto.userId ?? null,
      seasonId: dto.seasonId ?? null,
      profile: toProfileInput(dto.profile),
    });
  }

  @Get()
  @RequirePermissions(Permission.MemberList)
  @ApiOperation({ summary: 'List team members' })
  @ApiOkResponse({ description: 'Members', type: ListMembersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Query() query: ListMembersQueryDto,
  ): Promise<ListMembersResponseDto> {
    return this.directory.listMembers(
      teamId,
      resolvePage(query.limit, query.offset),
    );
  }

  @Get(MEMBER_BY_ID_ROUTE)
  @RequirePermissions(Permission.MemberProfileReadPublic)
  @ApiOperation({ summary: 'Get a member, shaped for the viewer audience' })
  @ApiOkResponse({ description: 'Member', type: MemberViewResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  get(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MemberViewResponseDto> {
    return this.memberView.getMember(actor, teamId, membershipId);
  }

  @Patch(MEMBER_PROFILE_ROUTE)
  @RequirePermissions(Permission.MemberProfileUpdateSelf)
  @ApiOperation({ summary: 'Update a member profile' })
  @ApiOkResponse({
    description: 'Profile updated',
    type: MemberViewResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MemberViewResponseDto> {
    return this.updateProfile.execute(actor, teamId, membershipId, {
      profile: toProfileInput(dto.profile),
      expectedVersion: dto.expectedVersion,
    });
  }

  @Post(MEMBER_ACTIVATE_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({
    summary:
      'Activate a member (also restores an inactive/suspended/archived one)',
  })
  @ApiOkResponse({
    description: 'Member activated',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  activate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.transitionMember.execute(
      actor,
      teamId,
      membershipId,
      MembershipStatus.Active,
      { reason: dto.reason ?? null, effectiveAt: dto.effectiveAt ?? null },
    );
  }

  @Post(MEMBER_DEACTIVATE_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'Deactivate a member' })
  @ApiOkResponse({
    description: 'Member deactivated',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  deactivate(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.transitionMember.execute(
      actor,
      teamId,
      membershipId,
      MembershipStatus.Inactive,
      { reason: dto.reason ?? null, effectiveAt: dto.effectiveAt ?? null },
    );
  }

  @Post(MEMBER_SUSPEND_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'Suspend a member' })
  @ApiOkResponse({
    description: 'Member suspended',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  suspend(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.transitionMember.execute(
      actor,
      teamId,
      membershipId,
      MembershipStatus.Suspended,
      { reason: dto.reason ?? null, effectiveAt: dto.effectiveAt ?? null },
    );
  }

  @Post(MEMBER_LEAVE_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'Record that a member left the team' })
  @ApiOkResponse({ description: 'Member left', type: MembershipResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  leave(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.transitionMember.execute(
      actor,
      teamId,
      membershipId,
      MembershipStatus.Left,
      { reason: dto.reason ?? null, effectiveAt: dto.effectiveAt ?? null },
    );
  }

  @Post(MEMBER_ARCHIVE_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'Archive a member' })
  @ApiOkResponse({
    description: 'Member archived',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  archive(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.transitionMember.execute(
      actor,
      teamId,
      membershipId,
      MembershipStatus.Archived,
      { reason: dto.reason ?? null, effectiveAt: dto.effectiveAt ?? null },
    );
  }

  @Post(MEMBER_ANONYMIZE_ROUTE)
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'Anonymize a member (privileged retention)' })
  @ApiOkResponse({
    description: 'Member anonymized',
    type: MembershipResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  anonymize(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MembershipResponseDto> {
    return this.anonymizeMember.execute(actor, teamId, membershipId, {
      reason: dto.reason ?? null,
      effectiveAt: dto.effectiveAt ?? null,
    });
  }

  @Get(MEMBER_HISTORY_ROUTE)
  @RequirePermissions(Permission.MemberLifecycleManage)
  @ApiOperation({ summary: 'Get a member status-history timeline' })
  @ApiOkResponse({ description: 'History', type: MemberHistoryResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  historyOf(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
  ): Promise<MemberHistoryResponseDto> {
    return this.history.listHistory(teamId, membershipId);
  }
}
