import { registerAs } from '@nestjs/config';
import { type LogLevel, NodeEnv } from '@shared/enums';

import {
  APP_CONFIG_NAMESPACE,
  DEFAULT_APP_NAME,
  DEFAULT_GLOBAL_PREFIX,
  DEFAULT_LOG_LEVEL,
  DEFAULT_PORT,
  NODE_ENV_CONFIG_NAME,
} from './config.constants';
import type { AppConfig } from './config.types';
import {
  parseBoolean,
  parseInteger,
  parseNodeEnv,
  requireConfigValue,
} from './config.utils';

export const appConfig = registerAs(APP_CONFIG_NAMESPACE, (): AppConfig => {
  const nodeEnv = parseNodeEnv(
    requireConfigValue(process.env['NODE_ENV'], NODE_ENV_CONFIG_NAME),
  );

  return {
    nodeEnv,
    port: parseInteger(process.env['PORT'], DEFAULT_PORT),
    name: process.env['APP_NAME'] ?? DEFAULT_APP_NAME,
    globalPrefix: process.env['GLOBAL_PREFIX'] ?? DEFAULT_GLOBAL_PREFIX,
    swaggerEnabled: parseBoolean(
      process.env['ENABLE_SWAGGER'],
      nodeEnv !== NodeEnv.Production,
    ),
    logLevel:
      (process.env['LOG_LEVEL'] as LogLevel | undefined) ?? DEFAULT_LOG_LEVEL,
  };
});
