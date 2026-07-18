import { ApiSecurity } from '@core/openapi';
import { applyDecorators, SetMetadata } from '@nestjs/common';

import { AUTH_PUBLIC_KEY } from './auth.constants';

export const Public = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(AUTH_PUBLIC_KEY, true), ApiSecurity({}));
