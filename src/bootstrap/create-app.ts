import { AppModule } from '@app/app.module';
import { JwtAuthGuard, PermissionsGuard } from '@core/auth';
import { bindAppLogger } from '@core/logger';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createFastifyAdapter } from './fastify-adapter';

// Constructs the Nest application on the Fastify adapter and routes all Nest
// framework logs through the logger module (bufferLogs holds early logs until
// the logger is attached). Configuration is done by the configure-* steps.
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(),
    { bufferLogs: true },
  );
  bindAppLogger(app);

  app.useGlobalGuards(app.get(JwtAuthGuard), app.get(PermissionsGuard));

  return app;
}
