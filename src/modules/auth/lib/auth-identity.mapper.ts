import type { AuthUserIdentity } from '@core/auth';

import type { User } from '../../users';

export function toAuthUserIdentity(user: User): AuthUserIdentity {
  return {
    userId: user.id,
    email: user.email,
    roles: user.roles,
  };
}
