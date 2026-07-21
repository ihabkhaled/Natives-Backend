import { AppConfigService } from '@config/app-config.service';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SECONDS,
} from './bootstrap.constants';
import { registerCorrelationHeader } from './register-correlation-header';

// Registers the security-relevant Fastify plugins (Helmet response headers,
// cookie parsing, the correlation-id response header) and configures CORS from
// typed config. When no origins are configured, CORS is closed by default.
// See rules/07.
//
// Every CORS field below is explicit, because a browser silently drops whatever
// is not named:
//   - `methods`: @fastify/cors reflects exactly this list on the preflight
//     response (it does not infer it from the actual route), so omitting
//     PUT/PATCH/DELETE blocks every mutating request as a CORS failure the app
//     never sees;
//   - `allowedHeaders`: the request headers the client is permitted to send;
//   - `exposedHeaders`: the response headers the client is permitted to READ.
//     Without it a cross-origin caller sees only the seven safelisted headers,
//     so `x-request-id` / `content-disposition` / `retry-after` read as null
//     even though they are on the wire;
//   - `credentials`: cookies and Authorization are carried, which is only legal
//     against an explicit origin allowlist — never a wildcard;
//   - `maxAge`: caches the preflight so a burst of requests costs one OPTIONS.
export async function configureSecurity(
  app: NestFastifyApplication,
): Promise<void> {
  const { corsOrigins } = app.get(AppConfigService).security;

  await app.register(helmet);
  await app.register(cookie);
  registerCorrelationHeader(app);

  app.enableCors({
    origin: corsOrigins.length > 0 ? [...corsOrigins] : false,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    credentials: true,
    maxAge: CORS_MAX_AGE_SECONDS,
  });
}
