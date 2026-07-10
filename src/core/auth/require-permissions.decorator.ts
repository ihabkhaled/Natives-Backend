import type { CustomDecorator } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@shared/enums';

import { AUTH_PERMISSIONS_KEY } from './auth.constants';

export function RequirePermissions(
  ...permissions: readonly Permission[]
): CustomDecorator {
  return SetMetadata(AUTH_PERMISSIONS_KEY, permissions);
}
