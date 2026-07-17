import { Test } from '@nestjs/testing';
import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersRepository } from '../infrastructure/users.repository';
import type { User } from '../model/user.types';
import { UsersService } from './users.service';

const user: User = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hash',
  roles: [Role.User],
};

describe('UsersService', () => {
  const repository = { findByEmail: vi.fn() };
  let service: UsersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('returns a user found by email', async () => {
    repository.findByEmail.mockResolvedValue(user);

    const result = await service.findByEmail('user@example.com');

    expect(result).toEqual(user);
  });

  it('returns null when the user is not found', async () => {
    repository.findByEmail.mockResolvedValue(null);

    const result = await service.findByEmail('missing@example.com');

    expect(result).toBeNull();
  });
});
