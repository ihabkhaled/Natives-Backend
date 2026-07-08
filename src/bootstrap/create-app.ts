import { AppModule } from '@app/app.module';
import { bindAppLogger } from '@core/logger';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/roles.guard';
import { NestFactory, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
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

  app.useGlobalGuards(
    new JwtAuthGuard(app.get(JwtService), app.get(Reflector)),
    new RolesGuard(app.get(Reflector)),
  );

  return app;
}
