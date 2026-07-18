import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import {
  SWAGGER_BEARER_NAME,
  SWAGGER_DESCRIPTION,
  SWAGGER_TITLE,
  SWAGGER_VERSION,
} from './bootstrap.constants';
import type { OpenApiDocument } from './openapi-document.types';
import { createOpenApiOperationId } from './openapi-operation-id';

export function createOpenApiDocument(app: INestApplication): OpenApiDocument {
  const documentConfig = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      SWAGGER_BEARER_NAME,
    )
    .addSecurityRequirements(SWAGGER_BEARER_NAME)
    .build();

  return SwaggerModule.createDocument(app, documentConfig, {
    deepScanRoutes: true,
    operationIdFactory: createOpenApiOperationId,
  });
}
