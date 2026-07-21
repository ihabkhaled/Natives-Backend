import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { AppConfigService } from './app-config.service';
import { databaseConfig } from './database.config';
import { emailConfig } from './email.config';
import { validateEnv } from './env.validation';
import { identityConfig } from './identity.config';
import { securityConfig } from './security.config';

/**
 * Owns the configuration vendor (@nestjs/config). Consumers inject the typed
 * `AppConfigService`; nothing outside src/config imports the vendor directly.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        securityConfig,
        databaseConfig,
        identityConfig,
        emailConfig,
      ],
      validate: validateEnv,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
