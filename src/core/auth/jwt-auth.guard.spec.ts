import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnauthorizedError } from '../errors/unauthorized.error';
import {
  AUTH_INVALID_TOKEN_MESSAGE_KEY,
  AUTH_TOKEN_REQUIRED_MESSAGE_KEY,
} from './auth.constants';
import type { AuthRequest, AuthUserIdentity } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';

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

describe('JwtAuthGuard', () => {
  const tokenPort = { sign: vi.fn(), verify: vi.fn() };
  const reflector = { getAllAndOverride: vi.fn() };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(tokenPort, reflector as unknown as Reflector);
  });

  it('allows public routes without reading a token', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(buildContext({ headers: {} }))).toBe(true);
    expect(tokenPort.verify).not.toHaveBeenCalled();
  });

  it('throws a typed error when the authorization header is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() => guard.canActivate(buildContext({ headers: {} }))).toThrow(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_TOKEN_REQUIRED_MESSAGE_KEY,
      }),
    );
  });

  it('throws a typed error when token verification fails', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenPort.verify.mockReturnValue(null);

    expect(() =>
      guard.canActivate(
        buildContext({ headers: { authorization: 'Bearer invalid' } }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_INVALID_TOKEN_MESSAGE_KEY,
      }),
    );
  });

  it('treats a malformed authorization header as an invalid token', () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    expect(() =>
      guard.canActivate(
        buildContext({ headers: { authorization: 'Basic credentials' } }),
      ),
    ).toThrow(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_INVALID_TOKEN_MESSAGE_KEY,
      }),
    );
    expect(tokenPort.verify).not.toHaveBeenCalled();
  });

  it('attaches the verified identity and allows the request', () => {
    const identity: AuthUserIdentity = {
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
    };
    const request: AuthRequest = {
      headers: { authorization: 'Bearer valid' },
    };
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenPort.verify.mockReturnValue(identity);

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(request.user).toEqual(identity);
  });
});
