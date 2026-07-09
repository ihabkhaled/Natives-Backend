import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { UserCredentials } from '../../users';
import { UsersService } from '../../users';
import type { AuthUserIdentity } from '../auth.types';
import { verifyPassword } from '../lib/password.helpers';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(credentials: UserCredentials): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(credentials.email);
    if (user === null) {
      throw new UnauthorizedException();
    }

    const passwordMatches = await verifyPassword(
      credentials.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException();
    }

    return {
      accessToken: await this.jwtService.signAsync(this.toIdentity(user)),
    };
  }

  private toIdentity(user: {
    id: string;
    email: string;
    roles: readonly string[];
  }): AuthUserIdentity {
    return {
      userId: user.id,
      email: user.email,
      roles: user.roles,
    };
  }
}
