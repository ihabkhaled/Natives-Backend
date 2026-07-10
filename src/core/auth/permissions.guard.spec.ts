import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError } from '../errors/forbidden.error';
import { UnauthorizedError } from '../errors/unauthorized.error';
import {
  AUTH_IDENTITY_REQUIRED_MESSAGE_KEY,
  AUTH_PERMISSION_DENIED_MESSAGE_KEY,
} from './auth.constants';
import type { AuthRequest } from './auth.types';
import { PermissionsGuard } from './permissions.guard';

const handler = (): string => 'handler';
const Controller = class {};

function buildContext(request: AuthRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => Controller,
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  let guard: PermissionsGuard;

  beforeEach(() => {
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('allows routes with no permission metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext({ headers: {} }))).toBe(true);
  });

  it('throws a typed unauthorized error when identity is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.ArticleRead]);

    expect(() => guard.canActivate(buildContext({ headers: {} }))).toThrow(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_IDENTITY_REQUIRED_MESSAGE_KEY,
      }),
    );
  });

  it('allows an identity with all required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue([
      Permission.ArticleCreate,
      Permission.ArticleRead,
    ]);

    expect(
      guard.canActivate(
        buildContext({
          headers: {},
          user: {
            userId: 'user-1',
            email: 'user@example.com',
            roles: [Role.User],
          },
        }),
      ),
    ).toBe(true);
  });

  it('throws a typed forbidden error when permission is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.ArticleRead]);

    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {},
          user: {
            userId: 'user-1',
            email: 'user@example.com',
            roles: [],
          },
        }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<ForbiddenError>>({
        messageKey: AUTH_PERMISSION_DENIED_MESSAGE_KEY,
      }),
    );
  });
});
