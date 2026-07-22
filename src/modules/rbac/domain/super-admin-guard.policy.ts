import { LastSuperAdminError } from '../errors/last-super-admin.error';

/**
 * Last-administrator safeguard. Revoking a live global SUPER_ADMIN assignment
 * is only permitted while at least one other live global assignment remains, so
 * the platform can never lose its last super administrator — neither by
 * self-demotion nor by another admin's revoke. Pure: the caller supplies the
 * authoritative live count read inside the same transaction as the revoke.
 */
export function assertNotLastSuperAdmin(activeCount: number): void {
  if (activeCount <= 1) {
    throw new LastSuperAdminError();
  }
}
