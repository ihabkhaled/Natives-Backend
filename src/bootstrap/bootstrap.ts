import { AppConfigService } from '@config/app-config.service';

import { LISTEN_HOST } from './bootstrap.constants';
import { configureLifecycle } from './configure-lifecycle';
import { configureSecurity } from './configure-security';
import { configureSwagger } from './configure-swagger';
import { configureValidation } from './configure-validation';
import { createApp } from './create-app';

// Bootstrap orchestrator: create the app, then apply each cross-cutting concern
// through its dedicated configure-* step, then listen. Each step lives in its own
// file so this stays a readable, testable recipe. See context/architecture-map.md.
export async function bootstrap(): Promise<void> {
  const app = await createApp();

  await configureSecurity(app);
  await configureValidation(app);
  configureLifecycle(app);

  const { port, swaggerEnabled } = app.get(AppConfigService).app;

  if (swaggerEnabled) {
    configureSwagger(app);
  }

  await app.listen(port, LISTEN_HOST);
}
