import {
  type AuthTokenPort,
  type AuthUserIdentity,
  isAuthUserIdentity,
} from '@core/auth';
import { IntegrationError } from '@core/errors/integration.error';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  AUTH_TOKEN_ISSUE_FAILED_MESSAGE,
  AUTH_TOKEN_ISSUE_FAILED_MESSAGE_KEY,
} from '../model/auth.constants';

@Injectable()
export class JwtTokenAdapter implements AuthTokenPort {
  constructor(private readonly jwtService: JwtService) {}

  async sign(identity: AuthUserIdentity): Promise<string> {
    try {
      return await this.jwtService.signAsync(identity);
    } catch {
      throw new IntegrationError(
        AUTH_TOKEN_ISSUE_FAILED_MESSAGE,
        AUTH_TOKEN_ISSUE_FAILED_MESSAGE_KEY,
      );
    }
  }

  verify(token: string): AuthUserIdentity | null {
    try {
      const payload: unknown = this.jwtService.verify<object>(token);
      return isAuthUserIdentity(payload) ? payload : null;
    } catch {
      return null;
    }
  }
}
