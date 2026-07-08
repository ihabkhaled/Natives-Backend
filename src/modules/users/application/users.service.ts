import { Injectable } from '@nestjs/common';

import { UsersRepository } from '../infrastructure/users.repository';
import type { User } from '../model/user.types';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }
}
