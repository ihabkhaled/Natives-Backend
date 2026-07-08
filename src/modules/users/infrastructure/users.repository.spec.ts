import { compareSync } from 'bcrypt';
import { beforeEach, describe, expect, it } from 'vitest';

import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repository: UsersRepository;

  beforeEach(() => {
    repository = new UsersRepository();
  });

  it('returns the seeded reference user by email', async () => {
    const user = await repository.findByEmail('user@example.com');

    expect(user).not.toBeNull();
    expect(user?.email).toBe('user@example.com');
    expect(user?.roles).toContain('user');
    expect(compareSync('password', user?.passwordHash ?? '')).toBe(true);
  });

  it('returns null for an unknown email', async () => {
    const user = await repository.findByEmail('unknown@example.com');

    expect(user).toBeNull();
  });
});
