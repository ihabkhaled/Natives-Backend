import { ForbiddenError } from '@core/errors/forbidden.error';
import { UnauthorizedError } from '@core/errors/unauthorized.error';
import {
  type CanActivate,
  type ExecutionContext,
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
import { hasRequiredPermissions } from './permission.helpers';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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

    if (!hasRequiredPermissions(request.user.roles, requiredPermissions)) {
      throw new ForbiddenError(
        AUTH_PERMISSION_DENIED_MESSAGE,
        AUTH_PERMISSION_DENIED_MESSAGE_KEY,
      );
    }

    return true;
  }
}
