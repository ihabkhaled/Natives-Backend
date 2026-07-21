import { AppConfigService } from '@config/app-config.service';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { CORS_ALLOWED_METHODS } from './bootstrap.constants';

// Registers the security-relevant Fastify plugins (Helmet response headers,
// cookie parsing) and configures CORS from typed config. When no origins are
// configured, CORS is closed by default. See rules/07.
//
// `methods` must be explicit: @fastify/cors reflects whatever list is
// configured on the preflight response (it does not infer it from the actual
// route), so omitting PUT/PATCH/DELETE here silently blocks every mutating
// request from a browser as a CORS failure, not an HTTP error the app ever sees.
export async function configureSecurity(
  app: NestFastifyApplication,
): Promise<void> {
  const { corsOrigins } = app.get(AppConfigService).security;

  await app.register(helmet);
  await app.register(cookie);

  app.enableCors({
    origin: corsOrigins.length > 0 ? [...corsOrigins] : false,
    methods: [...CORS_ALLOWED_METHODS],
    credentials: true,
  });
}
