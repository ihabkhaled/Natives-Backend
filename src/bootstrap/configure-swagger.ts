import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import {
  SWAGGER_BEARER_NAME,
  SWAGGER_DESCRIPTION,
  SWAGGER_PATH,
  SWAGGER_PERSIST_AUTHORIZATION,
  SWAGGER_TITLE,
  SWAGGER_VERSION,
} from './bootstrap.constants';

// Mounts the OpenAPI document + UI. Guarded by the swaggerEnabled config flag in
// the bootstrap orchestrator so it can be disabled in production. See rules/17.
export function configureSwagger(app: INestApplication): void {
  const documentConfig = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      SWAGGER_BEARER_NAME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: SWAGGER_PERSIST_AUTHORIZATION,
    },
  });
}
