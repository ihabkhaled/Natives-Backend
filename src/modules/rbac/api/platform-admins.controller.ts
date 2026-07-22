import {
  type AuthUserIdentity,
  CurrentUser,
  RequirePermissions,
} from '@core/auth';
import {
  ApiConflictResponse,
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
} from '@nestjs/common';
import { Permission } from '@shared/enums';

import { ListSuperAdminsUseCase } from '../application/list-super-admins.use-case';
import { PromoteSuperAdminUseCase } from '../application/promote-super-admin.use-case';
import { RevokeSuperAdminUseCase } from '../application/revoke-super-admin.use-case';
import {
  RBAC_PLATFORM_ADMIN_BY_USER_ROUTE,
  RBAC_PLATFORM_ADMINS_API_TAG,
  RBAC_PLATFORM_ADMINS_ROUTE,
  RBAC_USER_ID_PARAM,
} from '../model/rbac.constants';
import { PromoteSuperAdminDto } from './dto/promote-super-admin.dto';
import { RevokeSuperAdminDto } from './dto/revoke-super-admin.dto';
import {
  SuperAdminEntryDto,
  SuperAdminListResponseDto,
} from './dto/super-admin-response.dto';

/**
 * Platform super-admin management. No `:teamId` appears in path or query, so
 * the request scope resolves globally and `platform.admin` is satisfied only by
 * a live global grant — an existing super administrator. Ordinary team flows
 * can never reach these routes, and the protected-role rule keeps SUPER_ADMIN
 * out of every team-scoped grant path.
 */
@ApiTags(RBAC_PLATFORM_ADMINS_API_TAG)
@Controller(RBAC_PLATFORM_ADMINS_ROUTE)
export class PlatformAdminsController {
  constructor(
    private readonly listSuperAdmins: ListSuperAdminsUseCase,
    private readonly promoteSuperAdmin: PromoteSuperAdminUseCase,
    private readonly revokeSuperAdmin: RevokeSuperAdminUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.PlatformAdmin)
  @ApiOperation({ summary: 'List the current platform super administrators' })
  @ApiOkResponse({
    description: 'Super administrators',
    type: SuperAdminListResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(): Promise<SuperAdminListResponseDto> {
    return this.listSuperAdmins.execute();
  }

  @Post()
  @RequirePermissions(Permission.PlatformAdmin)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Promote a user to super administrator with an audited reason',
  })
  @ApiCreatedResponse({
    description: 'Super administrator granted (idempotent)',
    type: SuperAdminEntryDto,
  })
  @ApiConflictResponse({ description: 'Target user missing or not active' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  promote(
    @Body() dto: PromoteSuperAdminDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SuperAdminEntryDto> {
    return this.promoteSuperAdmin.execute(actor, {
      userId: dto.userId,
      reason: dto.reason,
    });
  }

  @Delete(RBAC_PLATFORM_ADMIN_BY_USER_ROUTE)
  @RequirePermissions(Permission.PlatformAdmin)
  @ApiOperation({
    summary: 'Revoke a super administrator with an audited reason',
  })
  @ApiOkResponse({
    description: 'Super administrator revoked',
    type: SuperAdminEntryDto,
  })
  @ApiConflictResponse({
    description: 'The last super administrator cannot be removed',
  })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  revoke(
    @Param(RBAC_USER_ID_PARAM, UuidValidationPipe) userId: string,
    @Body() dto: RevokeSuperAdminDto,
    @CurrentUser() actor: AuthUserIdentity,
  ): Promise<SuperAdminEntryDto> {
    return this.revokeSuperAdmin.execute(actor, userId, dto.reason);
  }
}
