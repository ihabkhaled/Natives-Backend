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

const IDENTITY = {
  userId: 'user-1',
  email: 'user@example.com',
  roles: [Role.User],
};

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: vi.fn() };
  const resolver = { resolve: vi.fn() };
  let guard: PermissionsGuard;

  beforeEach(() => {
    guard = new PermissionsGuard(reflector as unknown as Reflector, resolver);
  });

  it('allows routes with no permission metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).resolves.toBe(true);
  });

  it('allows routes with an empty permission requirement', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).resolves.toBe(true);
  });

  it('throws a typed unauthorized error when identity is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.TeamRead]);

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).rejects.toThrow(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_IDENTITY_REQUIRED_MESSAGE_KEY,
      }),
    );
  });

  it('resolves permissions for the request scope and allows when granted', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.TeamRead]);
    resolver.resolve.mockResolvedValue(new Set<string>([Permission.TeamRead]));

    const result = await guard.canActivate(
      buildContext({
        headers: {},
        user: IDENTITY,
        params: { teamId: 'team-1' },
      }),
    );

    expect(result).toBe(true);
    expect(resolver.resolve).toHaveBeenCalledWith(IDENTITY, {
      teamId: 'team-1',
    });
  });

  it('throws a typed forbidden error when a required permission is missing in scope', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.TeamRead]);
    resolver.resolve.mockResolvedValue(new Set<string>());

    await expect(
      guard.canActivate(buildContext({ headers: {}, user: IDENTITY })),
    ).rejects.toThrow(
      expect.objectContaining<Partial<ForbiddenError>>({
        messageKey: AUTH_PERMISSION_DENIED_MESSAGE_KEY,
      }),
    );
  });
});
