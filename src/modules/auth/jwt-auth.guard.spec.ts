import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUserIdentity } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = { verify: vi.fn() };
  const reflector = { getAllAndOverride: vi.fn() };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      reflector as unknown as Reflector,
    );
  });

  const handler = () => 'handler';
  const controller = class Controller {};

  const buildContext = (headers: { authorization?: string }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers, user: undefined }),
      }),
      getHandler: () => handler,
      getClass: () => controller,
    }) as unknown as ExecutionContext;

  it('allows public routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const result = guard.canActivate(buildContext({}));

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when the authorization header is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the token is invalid', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    expect(() =>
      guard.canActivate(buildContext({ authorization: 'Bearer bad-token' })),
    ).toThrow(UnauthorizedException);
  });

  it('attaches the verified user to the request and returns true', () => {
    const identity: AuthUserIdentity = {
      userId: 'user-1',
      email: 'user@example.com',
      roles: ['user'],
    };
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verify.mockReturnValue(identity);

    const request = {
      headers: { authorization: 'Bearer valid-token' },
      user: undefined,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => handler,
      getClass: () => controller,
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(identity);
  });
});
