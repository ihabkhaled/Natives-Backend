import { Injectable, Scope } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { sanitizeLogContext } from './log-context.sanitizer';
import type { AppLoggerPort, LogContext } from './logger.port';

/**
 * The only injectable logger for application code. Wraps the logging vendor
 * behind `AppLoggerPort` with an app-owned signature (message first, context
 * second). Transient so each consumer gets its own instance/context.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements AppLoggerPort {
  constructor(private readonly pinoLogger: PinoLogger) {}

  setContext(context: string): void {
    this.pinoLogger.setContext(context);
  }

  debug(message: string, context?: LogContext): void {
    if (context === undefined) {
      this.pinoLogger.debug(message);
      return;
    }
    this.pinoLogger.debug(sanitizeLogContext(context), message);
  }

  info(message: string, context?: LogContext): void {
    if (context === undefined) {
      this.pinoLogger.info(message);
      return;
    }
    this.pinoLogger.info(sanitizeLogContext(context), message);
  }

  warn(message: string, context?: LogContext): void {
    if (context === undefined) {
      this.pinoLogger.warn(message);
      return;
    }
    this.pinoLogger.warn(sanitizeLogContext(context), message);
  }

  error(message: string, context?: LogContext): void {
    if (context === undefined) {
      this.pinoLogger.error(message);
      return;
    }
    this.pinoLogger.error(sanitizeLogContext(context), message);
  }
}
