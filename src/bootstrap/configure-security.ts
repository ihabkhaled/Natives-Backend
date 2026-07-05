import type { SecurityConfig } from '@config/config.types';
import { SECURITY_CONFIG_NAMESPACE } from '@config/security.config';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

// Registers the security-relevant Fastify plugins (Helmet response headers,
// cookie parsing) and configures CORS from typed config. When no origins are
// configured, CORS is closed by default. See rules/07.
export async function configureSecurity(
  app: NestFastifyApplication,
): Promise<void> {
  const security = app
    .get(ConfigService)
    .getOrThrow<SecurityConfig>(SECURITY_CONFIG_NAMESPACE);

  await app.register(helmet);
  await app.register(cookie);

  app.enableCors({
    origin: security.corsOrigins.length > 0 ? [...security.corsOrigins] : false,
    credentials: true,
  });
}
