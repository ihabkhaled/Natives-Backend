import {
  EFFECTIVE_PERMISSION_RESOLVER_PORT,
  type EffectivePermissionResolverPort,
} from '@core/auth';
import {
  type TransactionScope,
  UNIT_OF_WORK_PORT,
  type UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import { Inject, Injectable } from '@nestjs/common';

import { canAuthenticate } from '../domain/user-status.policy';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { UserRepository } from '../infrastructure/user.repository';
import {
  buildAuthUserPayload,
  toAuthUserIdentity,
} from '../lib/identity.mapper';
import type { AuthUserPayload, User } from '../model/identity.types';

/**
 * Resolves the current principal for GET /me. Re-checks live user state on every
 * call so a token belonging to a user who was deactivated, suspended, or deleted
 * mid-session is rejected with a generic error.
 */
@Injectable()
export class GetCurrentPrincipalUseCase {
  constructor(
    @Inject(UNIT_OF_WORK_PORT) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(EFFECTIVE_PERMISSION_RESOLVER_PORT)
    private readonly permissionResolver: EffectivePermissionResolverPort,
    private readonly users: UserRepository,
  ) {}

  async execute(userId: string): Promise<AuthUserPayload> {
    const user = await this.unitOfWork.runInTransaction(scope =>
      this.run(scope, userId),
    );
    const granted = await this.permissionResolver.resolve(
      toAuthUserIdentity(user),
      {},
    );
    return buildAuthUserPayload(user, [...granted].sort());
  }

  private async run(scope: TransactionScope, userId: string): Promise<User> {
    const user = await this.users.findById(scope, userId);
    if (user === null || !canAuthenticate(user)) {
      throw new InvalidCredentialsError();
    }
    return user;
  }
}
