import { AppLogger } from '@core/logger';
import { createValidationExceptionFactory } from '@core/validation';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

// Installs the global ValidationPipe: whitelist strips unknown properties,
// forbidNonWhitelisted rejects extras, transform builds typed DTO instances, and
// the logging exception factory records every rejected DTO. See rules/05.
export async function configureValidation(
  app: INestApplication,
): Promise<void> {
  // AppLogger is transient-scoped, so it must be resolved (not `get`).
  const logger = await app.resolve(AppLogger);
  logger.setContext('ValidationPipe');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
      exceptionFactory: createValidationExceptionFactory(logger),
    }),
  );
}
