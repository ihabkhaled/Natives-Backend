import { EFFECTIVE_PERMISSION_RESOLVER_PORT } from '@core/auth';
import { ClockModule } from '@core/clock/clock.module';
import { IdGeneratorModule } from '@core/id-generator/id-generator.module';
import { Module } from '@nestjs/common';

import { RbacController } from './api/rbac.controller';
import { AssignRoleUseCase } from './application/assign-role.use-case';
import { GetEffectivePermissionsUseCase } from './application/get-effective-permissions.use-case';
import { ListUserAssignmentsUseCase } from './application/list-user-assignments.use-case';
import { PrivilegeCeilingService } from './application/privilege-ceiling.service';
import { RbacPermissionResolverService } from './application/rbac-permission-resolver.service';
import { RevokeRoleAssignmentUseCase } from './application/revoke-role-assignment.use-case';
import { RbacRepository } from './infrastructure/rbac.repository';

/**
 * RBAC bounded context: the permission catalog, role bundles, scoped role
 * assignments, effective-permission resolution (behind the core resolver port,
 * with cache + explicit invalidation), and the admin assignment/inspection
 * endpoints with anti-escalation. Owns its persistence (raw SQL via the
 * UnitOfWorkPort). Exported so the AuthModule can bind the global PermissionsGuard
 * to the resolver. No other module imports its internals.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule],
  controllers: [RbacController],
  providers: [
    RbacRepository,
    PrivilegeCeilingService,
    AssignRoleUseCase,
    RevokeRoleAssignmentUseCase,
    ListUserAssignmentsUseCase,
    GetEffectivePermissionsUseCase,
    RbacPermissionResolverService,
    {
      provide: EFFECTIVE_PERMISSION_RESOLVER_PORT,
      useExisting: RbacPermissionResolverService,
    },
  ],
  exports: [EFFECTIVE_PERMISSION_RESOLVER_PORT],
})
export class RbacModule {}
