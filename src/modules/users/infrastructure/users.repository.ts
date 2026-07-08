import { Injectable } from '@nestjs/common';
import { hashSync } from 'bcrypt';

import type { User } from '../model/user.types';

@Injectable()
export class UsersRepository {
  private readonly store = new Map<string, User>();

  constructor() {
    const user: User = {
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hashSync('password', 10),
      roles: ['user'],
    };
    this.store.set(user.email, user);
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.store.get(email) ?? null);
  }
}
