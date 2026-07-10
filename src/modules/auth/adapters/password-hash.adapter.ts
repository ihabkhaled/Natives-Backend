import { Injectable } from '@nestjs/common';
import { compare } from 'bcrypt';

import type { PasswordHashPort } from '../model/auth.types';

@Injectable()
export class PasswordHashAdapter implements PasswordHashPort {
  matches(plainPassword: string, passwordHash: string): Promise<boolean> {
    return compare(plainPassword, passwordHash);
  }
}
