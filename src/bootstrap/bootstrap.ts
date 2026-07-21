import { buildSeeders, DatabaseLifecycleService } from '@app/database';
import { AppConfigService } from '@config/app-config.service';
import { loadSeedAdminConfig } from '@config/seed-admin.config';
import { loadSeedPersonasConfig } from '@config/seed-personas.config';
import { PASSWORD_HASH_PORT, type PasswordHashPort } from '@modules/auth';
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

// Run the boot-time database lifecycle (migrations + once-only seeds) after the
// app (and its DataSource) are assembled but before the port is bound, so the
// process never serves traffic on a wrong schema. The seed registry is built
// here at the composition root: the password-hash port and the lazy admin-config
// loader are supplied so the database layer stays free of auth/module coupling.
async function runBootDatabaseLifecycle(
  app: NestFastifyApplication,
): Promise<void> {
  const passwordHash = app.get<PasswordHashPort>(PASSWORD_HASH_PORT);
  const seeders = buildSeeders({
    passwordHash,
    loadAdminConfig: loadSeedAdminConfig,
    loadPersonasConfig: loadSeedPersonasConfig,
  });
  await app.get(DatabaseLifecycleService).run(seeders);
}

// Long-running-process entrypoint: assemble the app, run the database lifecycle,
// then bind the port. Each step lives in its own file so this stays a readable,
// testable recipe. See context/architecture-map.md.
export async function bootstrap(): Promise<void> {
  const app = await createConfiguredApp();

  await runBootDatabaseLifecycle(app);

  const { port } = app.get(AppConfigService).app;
  await app.listen(port, LISTEN_HOST);
}
