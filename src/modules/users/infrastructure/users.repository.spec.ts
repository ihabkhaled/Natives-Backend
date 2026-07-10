import { Role } from '@shared/enums';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  REFERENCE_USER_EMAIL,
  REFERENCE_USER_PASSWORD_HASH,
} from '../model/user.constants';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;

  beforeEach(() => {
    repository = new UsersRepository();
  });

  it('returns the seeded reference user by email', async () => {
    const user = await repository.findByEmail(REFERENCE_USER_EMAIL);

    expect(user).not.toBeNull();
    expect(user?.email).toBe(REFERENCE_USER_EMAIL);
    expect(user?.roles).toContain(Role.User);
    expect(user?.passwordHash).toBe(REFERENCE_USER_PASSWORD_HASH);
  });

  it('returns null for an unknown email', async () => {
    const user = await repository.findByEmail('unknown@example.com');

    expect(user).toBeNull();
  });
});
