import type { Role } from '@shared/enums';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly roles: readonly Role[];
}
