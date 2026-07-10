import { Injectable } from '@nestjs/common';

import { REFERENCE_USER } from '../model/user.constants';
import type { User } from '../model/user.types';

@Injectable()
export class UsersRepository {
  private readonly store = new Map<string, User>([
    [REFERENCE_USER.email, REFERENCE_USER],
  ]);

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.store.get(email) ?? null);
  }
}
