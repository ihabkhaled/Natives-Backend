import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  APP_CONFIG_NAMESPACE,
  DATABASE_CONFIG_NAMESPACE,
  EMAIL_CONFIG_NAMESPACE,
  IDENTITY_CONFIG_NAMESPACE,
  JOBS_CONFIG_NAMESPACE,
  SECURITY_CONFIG_NAMESPACE,
} from './config.constants';
import type {
  AppConfig,
  DatabaseConfig,
  EmailConfig,
  IdentityConfig,
  JobsConfig,
  SecurityConfig,
} from './config.types';

/**
 * The only injectable configuration surface. Wraps the config vendor
 * (@nestjs/config) behind typed getters so consumers never touch ConfigService
 * or namespace strings — swapping the vendor touches only src/config.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get app(): AppConfig {
    return this.configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);
  }

  get security(): SecurityConfig {
    return this.configService.getOrThrow<SecurityConfig>(
      SECURITY_CONFIG_NAMESPACE,
    );
  }

  get database(): DatabaseConfig {
    return this.configService.getOrThrow<DatabaseConfig>(
      DATABASE_CONFIG_NAMESPACE,
    );
  }

  get identity(): IdentityConfig {
    return this.configService.getOrThrow<IdentityConfig>(
      IDENTITY_CONFIG_NAMESPACE,
    );
  }

  get email(): EmailConfig {
    return this.configService.getOrThrow<EmailConfig>(EMAIL_CONFIG_NAMESPACE);
  }

  get jobs(): JobsConfig {
    return this.configService.getOrThrow<JobsConfig>(JOBS_CONFIG_NAMESPACE);
  }
}
