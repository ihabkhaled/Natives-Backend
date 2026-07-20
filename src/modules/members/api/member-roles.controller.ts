import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@core/openapi';
import { UuidValidationPipe } from '@core/validation';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Permission } from '@shared/enums';

import { MemberRolesService } from '../application/member-roles.service';
import { ReplaceMemberRolesUseCase } from '../application/replace-member-roles.use-case';
import {
  MEMBER_ROLES_API_TAG,
  MEMBER_ROLES_ROUTE,
  MEMBERS_ROUTE,
  MEMBERSHIP_ID_PARAM,
  TEAM_ID_PARAM,
} from '../model/members.constants';
import { AssignMemberRolesDto } from './dto/assign-member-roles.dto';
import { MemberRolesResponseDto } from './dto/member-roles-response.dto';

@ApiTags(MEMBER_ROLES_API_TAG)
@Controller(MEMBERS_ROUTE)
export class MemberRolesController {
  constructor(
    private readonly memberRoles: MemberRolesService,
    private readonly replaceRoles: ReplaceMemberRolesUseCase,
  ) {}

  @Get(MEMBER_ROLES_ROUTE)
  @RequirePermissions(Permission.MemberProfileReadCoach)
  @ApiOperation({
    summary:
      'Read the roles a member holds in this team plus the actor ceiling',
  })
  @ApiOkResponse({ description: 'Member roles', type: MemberRolesResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({ description: 'Member not found in this team' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  read(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MemberRolesResponseDto> {
    return this.memberRoles.view(actor, teamId, membershipId);
  }

  @Put(MEMBER_ROLES_ROUTE)
  @RequirePermissions(Permission.MemberRolesManage)
  @ApiOperation({ summary: 'Replace the roles a member holds in this team' })
  @ApiOkResponse({
    description: 'Reconciled member roles',
    type: MemberRolesResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden or privilege ceiling exceeded',
  })
  @ApiNotFoundResponse({ description: 'Member or role not found' })
  @ApiConflictResponse({ description: 'Member has no linked account' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  assign(
    @Param(TEAM_ID_PARAM, UuidValidationPipe) teamId: string,
    @Param(MEMBERSHIP_ID_PARAM, UuidValidationPipe) membershipId: string,
    @Body() dto: AssignMemberRolesDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<MemberRolesResponseDto> {
    return this.replaceRoles.execute(actor, teamId, membershipId, dto.roles);
  }
}
