import { AppConfigService } from '@config/app-config.service';
import { Global, Module, RequestMethod } from '@nestjs/common';
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
        // nestjs-pino binds its request-logger middleware to the bare "*"
        // wildcard by default. Under the global prefix that resolves to
        // "/api/*", which path-to-regexp v8 (NestJS 11) flags via
        // LegacyRouteConverter and auto-converts to "/api/{*path}" at boot.
        // Bind with the named-parameter wildcard up front so the middleware
        // still matches every route with no legacy-conversion warning.
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      }),
    }),
  ],
  providers: [AppLogger],
  exports: [PinoLoggerModule, AppLogger],
})
export class LoggerModule {}
