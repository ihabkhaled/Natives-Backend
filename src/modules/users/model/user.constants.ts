import { Role } from '@shared/enums';

import type { User } from './user.types';

export const REFERENCE_USER_ID = 'user-1';
export const REFERENCE_USER_EMAIL = 'user@example.com';
export const REFERENCE_USER_PASSWORD_HASH =
  '$2b$10$HobO1TciaomoWrP6K7hnguwCCqn9dOcwHZvC8NUs8//VK2md4KxPO';

export const REFERENCE_USER: User = {
  id: REFERENCE_USER_ID,
  email: REFERENCE_USER_EMAIL,
  passwordHash: REFERENCE_USER_PASSWORD_HASH,
  roles: [Role.User],
};
