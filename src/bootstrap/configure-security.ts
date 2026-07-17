import { AppConfigService } from '@config/app-config.service';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

// Registers the security-relevant Fastify plugins (Helmet response headers,
// cookie parsing) and configures CORS from typed config. When no origins are
// configured, CORS is closed by default. See rules/07.
export async function configureSecurity(
  app: NestFastifyApplication,
): Promise<void> {
  const { corsOrigins } = app.get(AppConfigService).security;

  await app.register(helmet);
  await app.register(cookie);

  app.enableCors({
    origin: corsOrigins.length > 0 ? [...corsOrigins] : false,
    credentials: true,
  });
}
