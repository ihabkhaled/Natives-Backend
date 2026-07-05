import type { SecurityConfig } from '@config/config.types';
import { SECURITY_CONFIG_NAMESPACE } from '@config/security.config';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppExceptionFilter } from './errors/app-exception.filter';
import { HealthModule } from './health/health.module';

/**
 * Cross-cutting wiring: the global exception filter, a global rate-limit guard
 * (configured from typed security config), and the health endpoint.
 */
@Module({
  imports: [
    HealthModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => {
        const security = config.getOrThrow<SecurityConfig>(
          SECURITY_CONFIG_NAMESPACE,
        );
        return {
          throttlers: [
            { ttl: security.rateLimitTtlMs, limit: security.rateLimitMax },
          ],
        };
      },
    }),
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class CoreModule {}
