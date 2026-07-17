import { AppConfigService } from '@config/app-config.service';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/**
 * Owns the rate-limiting vendor (@nestjs/throttler) and applies it as a global
 * guard from typed config. Swapping the vendor touches only this folder.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            ttl: config.security.rateLimitTtlMs,
            limit: config.security.rateLimitMax,
          },
        ],
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
