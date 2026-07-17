import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

import { AUTH_PASSWORD_SALT_ROUNDS } from '../model/auth.constants';
import type { PasswordHashPort } from '../model/auth.types';

@Injectable()
export class PasswordHashAdapter implements PasswordHashPort {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, AUTH_PASSWORD_SALT_ROUNDS);
  }

  matches(plainPassword: string, passwordHash: string): Promise<boolean> {
    return compare(plainPassword, passwordHash);
  }
}
