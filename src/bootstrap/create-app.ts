import { AppModule } from '@app/app.module';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';

import { createFastifyAdapter } from './fastify-adapter';

// Constructs the Nest application on the Fastify adapter and routes all Nest
// framework logs through pino (bufferLogs holds early logs until the logger is
// attached). Configuration of the app is done by the configure-* steps.
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createFastifyAdapter(),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  return app;
}
