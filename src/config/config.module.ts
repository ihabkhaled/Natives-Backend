import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { validateEnv } from './env.validation';
import { securityConfig } from './security.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, securityConfig],
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
