import { AUTH_TOKEN_PORT, type AuthTokenPort } from '@core/auth';
import { Inject, Injectable } from '@nestjs/common';

import { UsersService } from '../../users';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { toAuthUserIdentity } from '../lib/auth-identity.mapper';
import {
  AUTH_DUMMY_PASSWORD_HASH,
  PASSWORD_HASH_PORT,
} from '../model/auth.constants';
import type {
  AuthCredentials,
  AuthToken,
  PasswordHashPort,
} from '../model/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(AUTH_TOKEN_PORT) private readonly tokenPort: AuthTokenPort,
    @Inject(PASSWORD_HASH_PORT)
    private readonly passwordHash: PasswordHashPort,
  ) {}

  async login(credentials: AuthCredentials): Promise<AuthToken> {
    const user = await this.usersService.findByEmail(credentials.email);
    const passwordHash = user?.passwordHash ?? AUTH_DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.passwordHash.matches(
      credentials.password,
      passwordHash,
    );
    if (user === null || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return {
      accessToken: await this.tokenPort.sign(toAuthUserIdentity(user)),
    };
  }
}
