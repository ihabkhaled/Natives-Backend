import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  APP_CONFIG_NAMESPACE,
  SECURITY_CONFIG_NAMESPACE,
} from './config.constants';
import type { AppConfig, SecurityConfig } from './config.types';

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
}
