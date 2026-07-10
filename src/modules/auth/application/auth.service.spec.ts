import { AUTH_TOKEN_PORT } from '@core/auth';
import { UnauthorizedError } from '@core/errors/unauthorized.error';
import { Test } from '@nestjs/testing';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../users';
import { UsersService } from '../../users';
import {
  AUTH_DUMMY_PASSWORD_HASH,
  AUTH_INVALID_CREDENTIALS_MESSAGE_KEY,
  PASSWORD_HASH_PORT,
} from '../model/auth.constants';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = { findByEmail: vi.fn() };
  const tokenPort = { sign: vi.fn(), verify: vi.fn() };
  const passwordHash = { matches: vi.fn() };
  let service: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: AUTH_TOKEN_PORT, useValue: tokenPort },
        { provide: PASSWORD_HASH_PORT, useValue: passwordHash },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('returns an access token for valid credentials', async () => {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'password-hash',
      roles: [Role.User],
    };
    usersService.findByEmail.mockResolvedValue(user);
    passwordHash.matches.mockResolvedValue(true);
    tokenPort.sign.mockResolvedValue('token');

    const result = await service.login({
      email: 'user@example.com',
      password: 'password',
    });

    expect(result.accessToken).toBe('token');
    expect(passwordHash.matches).toHaveBeenCalledWith(
      'password',
      'password-hash',
    );
    expect(tokenPort.sign).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'user@example.com',
      roles: [Role.User],
    });
  });

  it('throws a typed invalid-credentials error when the user is not found', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordHash.matches.mockResolvedValue(false);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_INVALID_CREDENTIALS_MESSAGE_KEY,
      }),
    );
    expect(passwordHash.matches).toHaveBeenCalledWith(
      'password',
      AUTH_DUMMY_PASSWORD_HASH,
    );
  });

  it('throws the same typed error when the password does not match', async () => {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'password-hash',
      roles: [Role.User],
    };
    usersService.findByEmail.mockResolvedValue(user);
    passwordHash.matches.mockResolvedValue(false);

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<UnauthorizedError>>({
        messageKey: AUTH_INVALID_CREDENTIALS_MESSAGE_KEY,
      }),
    );
  });
});
