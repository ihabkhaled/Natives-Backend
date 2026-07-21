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
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { AssignRoleUseCase } from '../application/assign-role.use-case';
import { GetEffectivePermissionsUseCase } from '../application/get-effective-permissions.use-case';
import { ListUserAssignmentsUseCase } from '../application/list-user-assignments.use-case';
import { RevokeRoleAssignmentUseCase } from '../application/revoke-role-assignment.use-case';
import { RoleMatrixQueryService } from '../application/role-matrix-query.service';
import { toPermissionScope } from '../lib/rbac.helpers';
import {
  RBAC_API_TAG,
  RBAC_ASSIGNMENT_BY_ID_ROUTE,
  RBAC_ASSIGNMENT_ID_PARAM,
  RBAC_ASSIGNMENTS_ROUTE,
  RBAC_ME_PERMISSIONS_ROUTE,
  RBAC_ROLE_BUNDLES_ROUTE,
  RBAC_ROUTE,
  RBAC_USER_ASSIGNMENTS_ROUTE,
  RBAC_USER_ID_PARAM,
} from '../model/rbac.constants';
import { AssignRoleDto } from './dto/assign-role.dto';
import { EffectivePermissionsResponseDto } from './dto/effective-permissions-response.dto';
import { RoleAssignmentResponseDto } from './dto/role-assignment-response.dto';
import { RoleMatrixResponseDto } from './dto/role-matrix-response.dto';
import { ScopeQueryDto } from './dto/scope-query.dto';
import { UserAssignmentsResponseDto } from './dto/user-assignments-response.dto';

@ApiTags(RBAC_API_TAG)
@Controller(RBAC_ROUTE)
export class RbacController {
  constructor(
    private readonly assignRole: AssignRoleUseCase,
    private readonly revokeAssignment: RevokeRoleAssignmentUseCase,
    private readonly listUserAssignments: ListUserAssignmentsUseCase,
    private readonly getEffectivePermissions: GetEffectivePermissionsUseCase,
    private readonly roleMatrixQuery: RoleMatrixQueryService,
  ) {}

  @Post(RBAC_ASSIGNMENTS_ROUTE)
  @RequirePermissions(Permission.MemberRolesManage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assign a role to a user within a team/season scope',
  })
  @ApiCreatedResponse({
    description: 'Role assigned',
    type: RoleAssignmentResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden or privilege ceiling exceeded',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  assign(
    @Query() query: ScopeQueryDto,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RoleAssignmentResponseDto> {
    return this.assignRole.execute(actor, {
      userId: dto.userId,
      roleKey: dto.roleKey,
      teamId: query.teamId ?? null,
      seasonId: query.seasonId ?? null,
      effectiveTo: dto.effectiveTo ?? null,
    });
  }

  @Delete(RBAC_ASSIGNMENT_BY_ID_ROUTE)
  @RequirePermissions(Permission.MemberRolesManage)
  @ApiOperation({ summary: 'Revoke a role assignment' })
  @ApiOkResponse({
    description: 'Assignment revoked',
    type: RoleAssignmentResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden or privilege ceiling exceeded',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revoke(
    @Param(RBAC_ASSIGNMENT_ID_PARAM, UuidValidationPipe) assignmentId: string,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<RoleAssignmentResponseDto> {
    return this.revokeAssignment.execute(actor, assignmentId);
  }

  @Get(RBAC_USER_ASSIGNMENTS_ROUTE)
  @RequirePermissions(Permission.MemberRolesManage)
  @ApiOperation({ summary: 'List a user active role assignments' })
  @ApiOkResponse({
    description: 'User assignments',
    type: UserAssignmentsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Param(RBAC_USER_ID_PARAM, UuidValidationPipe) userId: string,
  ): Promise<UserAssignmentsResponseDto> {
    return this.listUserAssignments.execute(userId);
  }

  @Get(RBAC_ROLE_BUNDLES_ROUTE)
  @RequirePermissions(Permission.MemberRolesManage)
  @ApiOperation({
    summary: 'Get the full role x permission matrix from the seeded catalog',
  })
  @ApiOkResponse({
    description: 'Role bundles and the permission catalog they draw from',
    type: RoleMatrixResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  roleBundles(): Promise<RoleMatrixResponseDto> {
    return this.roleMatrixQuery.execute();
  }

  @Get(RBAC_ME_PERMISSIONS_ROUTE)
  @ApiOperation({ summary: 'Get the current principal effective permissions' })
  @ApiOkResponse({
    description: 'Effective permissions for the active scope',
    type: EffectivePermissionsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  myPermissions(
    @CurrentUser() user: AuthUserIdentity,
    @Query() query: ScopeQueryDto,
  ): Promise<EffectivePermissionsResponseDto> {
    return this.getEffectivePermissions.execute(
      user,
      toPermissionScope(query.teamId ?? null, query.seasonId ?? null),
    );
  }
}
