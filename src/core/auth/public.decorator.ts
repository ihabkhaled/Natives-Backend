import type { CustomDecorator } from '@nestjs/common';
import { SetMetadata } from '@nestjs/common';

import { AUTH_PUBLIC_KEY } from './auth.constants';

export const Public = (): CustomDecorator => SetMetadata(AUTH_PUBLIC_KEY, true);
