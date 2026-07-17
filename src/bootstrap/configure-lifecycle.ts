import { AppConfigService } from '@config/app-config.service';
import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';

import { DEFAULT_API_VERSION } from './bootstrap.constants';

// Applies routing + lifecycle concerns: global prefix, URI versioning, and
// graceful-shutdown hooks (so OnModuleDestroy hooks run on SIGTERM). See rules/10.
export function configureLifecycle(app: INestApplication): void {
  const { globalPrefix } = app.get(AppConfigService).app;

  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: DEFAULT_API_VERSION,
  });
  app.enableShutdownHooks();
}
