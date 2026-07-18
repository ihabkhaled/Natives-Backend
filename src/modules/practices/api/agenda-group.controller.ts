import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AgendaGroupService } from '../application/agenda-group.service';
import {
  AGENDA_GROUP_BY_ID_ROUTE,
  AGENDA_GROUP_MEMBER_BY_ID_ROUTE,
  AGENDA_GROUP_MEMBERS_ROUTE,
  AGENDA_GROUPS_ROUTE,
  GROUP_ID_PARAM,
} from '../model/agendas.constants';
import {
  PRACTICES_API_TAG,
  PRACTICES_ROUTE,
  SESSION_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/practices.constants';
import { MEMBERSHIP_ID_PARAM } from '../model/rsvp.constants';
import { AssignGroupMembersDto } from './dto/assign-group-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupResponseDto } from './dto/group-response.dto';

@ApiTags(PRACTICES_API_TAG)
@Controller(PRACTICES_ROUTE)
export class AgendaGroupController {
  constructor(private readonly groups: AgendaGroupService) {}

  @Post(AGENDA_GROUPS_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Create a participant group' })
  @ApiCreatedResponse({ description: 'Created', type: GroupResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  createGroup(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Body() dto: CreateGroupDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GroupResponseDto> {
    return this.groups.createGroup(actor, teamId, sessionId, {
      name: dto.name,
      color: dto.color ?? null,
      coachMembershipId: dto.coachMembershipId ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Post(AGENDA_GROUP_MEMBERS_ROUTE)
  @HttpCode(200)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Assign memberships to a participant group' })
  @ApiOkResponse({ description: 'Assigned', type: GroupResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  assignMembers(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(GROUP_ID_PARAM, UuidValidationPipe) groupId: string,
    @Body() dto: AssignGroupMembersDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GroupResponseDto> {
    return this.groups.assignMembers(actor, teamId, sessionId, groupId, {
      membershipIds: dto.membershipIds,
    });
  }

  @Delete(AGENDA_GROUP_MEMBER_BY_ID_ROUTE)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Remove a membership from a participant group' })
  @ApiOkResponse({ description: 'Removed', type: GroupResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  removeMember(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(GROUP_ID_PARAM, UuidValidationPipe) groupId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<GroupResponseDto> {
    return this.groups.removeMember(
      actor,
      teamId,
      sessionId,
      groupId,
      membershipId,
    );
  }

  @Delete(AGENDA_GROUP_BY_ID_ROUTE)
  @HttpCode(204)
  @RequirePermissions(Permission.DrillManage)
  @ApiOperation({ summary: 'Remove a participant group' })
  @ApiNoContentResponse({ description: 'Removed' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  removeGroup(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(SESSION_ID_PARAM, UuidValidationPipe) sessionId: string,
    @Param(GROUP_ID_PARAM, UuidValidationPipe) groupId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<void> {
    return this.groups.removeGroup(actor, teamId, sessionId, groupId);
  }
}
