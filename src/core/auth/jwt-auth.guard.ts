import { UnauthorizedError } from '@core/errors/unauthorized.error';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  AUTH_INVALID_TOKEN_MESSAGE,
  AUTH_INVALID_TOKEN_MESSAGE_KEY,
  AUTH_PUBLIC_KEY,
  AUTH_TOKEN_PORT,
  AUTH_TOKEN_REQUIRED_MESSAGE,
  AUTH_TOKEN_REQUIRED_MESSAGE_KEY,
} from './auth.constants';
import type { AuthRequest, AuthTokenPort } from './auth.types';
import { extractBearerToken } from './bearer-token.parser';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_TOKEN_PORT) private readonly tokenPort: AuthTokenPort,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AUTH_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    if (authorization === undefined) {
      throw new UnauthorizedError(
        AUTH_TOKEN_REQUIRED_MESSAGE,
        AUTH_TOKEN_REQUIRED_MESSAGE_KEY,
      );
    }

    const token = extractBearerToken(authorization);
    if (typeof token !== 'string') {
      throw new UnauthorizedError(
        AUTH_INVALID_TOKEN_MESSAGE,
        AUTH_INVALID_TOKEN_MESSAGE_KEY,
      );
    }

    const identity = this.tokenPort.verify(token);
    if (identity === null) {
      throw new UnauthorizedError(
        AUTH_INVALID_TOKEN_MESSAGE,
        AUTH_INVALID_TOKEN_MESSAGE_KEY,
      );
    }

    request.user = identity;
    return true;
  }
}
