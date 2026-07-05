import { APP_CONFIG_NAMESPACE } from '@config/app.config';
import type { AppConfig } from '@config/config.types';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { buildPinoHttpOptions } from './http-logging.options';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): Params => ({
        pinoHttp: buildPinoHttpOptions(
          config.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE),
        ),
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
