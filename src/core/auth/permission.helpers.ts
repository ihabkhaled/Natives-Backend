import { ROLE_PERMISSIONS } from '@shared/constants';
import type { Permission, Role } from '@shared/enums';

export function hasRequiredPermissions(
  roles: readonly Role[],
  requiredPermissions: readonly Permission[],
): boolean {
  return requiredPermissions.every(permission =>
    roles.some(
      role => ROLE_PERMISSIONS.get(role)?.includes(permission) === true,
    ),
  );
}
