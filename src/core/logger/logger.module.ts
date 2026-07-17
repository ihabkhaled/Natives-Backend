import { AppConfigService } from '@config/app-config.service';
import { Global, Module } from '@nestjs/common';
import type { Params } from 'nestjs-pino';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { AppLogger } from './app-logger.service';
import { buildPinoHttpOptions } from './http-logging.options';

/**
 * Owns the logging vendor (nestjs-pino / pino / pino-http). Everything outside
 * this folder logs through `AppLogger` — swap the vendor here and nothing else
 * changes. See rules/12 and /eslint/package-boundaries.config.mjs.
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Params => ({
        pinoHttp: buildPinoHttpOptions(config.app),
      }),
    }),
  ],
  providers: [AppLogger],
  exports: [PinoLoggerModule, AppLogger],
})
export class LoggerModule {}
