import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../users';
import { UsersService } from '../../users';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const usersService = { findByEmail: vi.fn() };
  const jwtService = { signAsync: vi.fn() };
  let service: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('returns an access token for valid credentials', async () => {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hashSync('password', 10),
      roles: ['user'],
    };
    usersService.findByEmail.mockResolvedValue(user);
    jwtService.signAsync.mockResolvedValue('token');

    const result = await service.login({
      email: 'user@example.com',
      password: 'password',
    });

    expect(result.accessToken).toBe('token');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'user@example.com',
      roles: ['user'],
    });
  });

  it('throws UnauthorizedException when the user is not found', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hashSync('other-password', 10),
      roles: ['user'],
    };
    usersService.findByEmail.mockResolvedValue(user);

    await expect(
      service.login({ email: 'user@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
