import { ForbiddenError } from '@core/errors/forbidden.error';
import { UnauthorizedError } from '@core/errors/unauthorized.error';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@shared/enums';

import {
  AUTH_IDENTITY_REQUIRED_MESSAGE,
  AUTH_IDENTITY_REQUIRED_MESSAGE_KEY,
  AUTH_PERMISSION_DENIED_MESSAGE,
  AUTH_PERMISSION_DENIED_MESSAGE_KEY,
  AUTH_PERMISSIONS_KEY,
} from './auth.constants';
import type { AuthRequest } from './auth.types';
import {
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from './effective-permission-resolver.port';
import { hasAllPermissions } from './permission.helpers';
import { extractRequestScope } from './request-scope.extractor';

/**
 * Authorization guard. Resolves the authenticated principal's effective
 * permissions for the request's team/season scope through the resolver port
 * (account-role baseline unioned with database-backed scoped assignments) and
 * enforces `@RequirePermissions(...)` with AND-semantics. Cross-team/cross-season
 * access is denied because the required permission is not held within that scope.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly resolver: EffectivePermissionResolverPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      readonly Permission[] | undefined
    >(AUTH_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (requiredPermissions === undefined || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (request.user === undefined) {
      throw new UnauthorizedError(
        AUTH_IDENTITY_REQUIRED_MESSAGE,
        AUTH_IDENTITY_REQUIRED_MESSAGE_KEY,
      );
    }

    const scope = extractRequestScope(request);
    const granted = await this.resolver.resolve(request.user, scope);
    if (!hasAllPermissions(granted, requiredPermissions)) {
      throw new ForbiddenError(
        AUTH_PERMISSION_DENIED_MESSAGE,
        AUTH_PERMISSION_DENIED_MESSAGE_KEY,
      );
    }

    return true;
  }
}
