import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ClockModule } from './clock/clock.module';
import { AppExceptionFilter } from './errors/app-exception.filter';
import { HealthModule } from './health/health.module';
import { IdGeneratorModule } from './id-generator/id-generator.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';

/**
 * Cross-cutting wiring: the global exception filter, the rate-limit module
 * (which applies its own global guard), the health endpoint, and the injected
 * clock/id-generator ports used by the application layer.
 */
@Module({
  imports: [ClockModule, IdGeneratorModule, HealthModule, RateLimitModule],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class CoreModule {}
