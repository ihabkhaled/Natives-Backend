import { APP_CONFIG_NAMESPACE } from '@config/app.config';
import type { AppConfig } from '@config/config.types';
import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DEFAULT_API_VERSION } from './bootstrap.constants';

// Applies routing + lifecycle concerns: global prefix, URI versioning, and
// graceful-shutdown hooks (so OnModuleDestroy hooks run on SIGTERM). See rules/10.
export function configureLifecycle(app: INestApplication): void {
  const appConfig = app
    .get(ConfigService)
    .getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);

  app.setGlobalPrefix(appConfig.globalPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_API_VERSION,
  });
  app.enableShutdownHooks();
}
