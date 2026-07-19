import { AppConfigService } from '@config/app-config.service';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { LISTEN_HOST } from './bootstrap.constants';
import { configureLifecycle } from './configure-lifecycle';
import { configureSecurity } from './configure-security';
import { configureSwagger } from './configure-swagger';
import { configureValidation } from './configure-validation';
import { createApp } from './create-app';

// Create the app and apply every cross-cutting concern through its dedicated
// configure-* step, returning the fully configured (but not-yet-listening)
// application. This is the single reusable assembly point: `bootstrap` listens
// on it for a long-running process, while serverless entrypoints (e.g. Vercel's
// api/index.js) init it and forward requests without binding a port.
export async function createConfiguredApp(): Promise<NestFastifyApplication> {
  const app = await createApp();

  await configureSecurity(app);
  await configureValidation(app);
  configureLifecycle(app);

  if (app.get(AppConfigService).app.swaggerEnabled) {
    configureSwagger(app);
  }

  return app;
}

// Long-running-process entrypoint: assemble the app, then bind the port. Each
// step lives in its own file so this stays a readable, testable recipe. See
// context/architecture-map.md.
export async function bootstrap(): Promise<void> {
  const app = await createConfiguredApp();
  const { port } = app.get(AppConfigService).app;

  await app.listen(port, LISTEN_HOST);
}
