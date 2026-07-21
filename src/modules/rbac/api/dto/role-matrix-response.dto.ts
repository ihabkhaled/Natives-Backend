import { ApiProperty } from '@core/openapi';

import { PermissionCatalogEntryResponseDto } from './permission-catalog-entry-response.dto';
import { RoleBundleResponseDto } from './role-bundle-response.dto';

/**
 * The full role x permission matrix served to administration UIs: every catalog
 * permission, every role bundle, and the permission keys each bundle grants,
 * stamped with the RBAC policy version the snapshot was read at.
 */
export class RoleMatrixResponseDto {
  @ApiProperty({
    description:
      'RBAC policy version this matrix was read at; changes whenever a role assignment or bundle changes',
  })
  declare readonly policyVersion: number;

  @ApiProperty({ type: [PermissionCatalogEntryResponseDto] })
  declare readonly permissions: readonly PermissionCatalogEntryResponseDto[];

  @ApiProperty({ type: [RoleBundleResponseDto] })
  declare readonly roles: readonly RoleBundleResponseDto[];
}
