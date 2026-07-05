import { registerAs } from '@nestjs/config';
import { NodeEnv } from '@shared/enums';

import {
  DEFAULT_APP_NAME,
  DEFAULT_GLOBAL_PREFIX,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
  FLAG_TRUE,
} from './config.constants';
import type { AppConfig } from './config.types';
import { parseInteger } from './config.utils';

export const APP_CONFIG_NAMESPACE = 'app';

export const appConfig = registerAs(
  APP_CONFIG_NAMESPACE,
  (): AppConfig => ({
    nodeEnv:
      (process.env['NODE_ENV'] as NodeEnv | undefined) ?? NodeEnv.Development,
    port: parseInteger(process.env['PORT'], DEFAULT_PORT),
    name: process.env['APP_NAME'] ?? DEFAULT_APP_NAME,
    globalPrefix: process.env['GLOBAL_PREFIX'] ?? DEFAULT_GLOBAL_PREFIX,
    swaggerEnabled: (process.env['ENABLE_SWAGGER'] ?? FLAG_TRUE) === FLAG_TRUE,
    logLevel: process.env['LOG_LEVEL'] ?? DEFAULT_LOG_LEVEL,
  }),
);
