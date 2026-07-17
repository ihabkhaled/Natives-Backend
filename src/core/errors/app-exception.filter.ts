import type { HttpReplyLike } from '@core/http/http-reply.types';
import { AppLogger } from '@core/logger';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import { SERVER_ERROR_MIN_STATUS } from '@shared/constants';

import type { ErrorBody } from './error.types';
import { toErrorBody } from './error-body.mapper';

/**
 * Global exception filter. Sanitizes every thrown value into a safe body and
 * logs it: 5xx as `error` (with the original exception for the server-side log),
 * 4xx as `warn`. Nothing sensitive reaches the client. See rules/18.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(AppExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<HttpReplyLike>();
    const body = toErrorBody(exception);
    this.record(body, exception);
    reply.status(body.statusCode).send(body);
  }

  private record(body: ErrorBody, exception: unknown): void {
    if (body.statusCode >= SERVER_ERROR_MIN_STATUS) {
      this.logger.error(body.message, {
        statusCode: body.statusCode,
        messageKey: body.messageKey,
        err: exception,
      });
      return;
    }

    this.logger.warn(body.message, {
      statusCode: body.statusCode,
      messageKey: body.messageKey,
    });
  }
}
