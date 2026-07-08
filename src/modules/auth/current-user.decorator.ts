import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { AuthUserIdentity } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUserIdentity => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthUserIdentity }>();
    return request.user;
  },
);
