import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';

import {
  SWAGGER_PATH,
  SWAGGER_PERSIST_AUTHORIZATION,
} from './bootstrap.constants';
import { createOpenApiDocument } from './openapi-document';

// Mounts the OpenAPI document + UI. Guarded by the swaggerEnabled config flag in
// the bootstrap orchestrator so it can be disabled in production. See rules/17.
export function configureSwagger(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: SWAGGER_PERSIST_AUTHORIZATION,
    },
  });
}
