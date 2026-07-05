import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import { SERVER_ERROR_MIN_STATUS } from '@shared/constants';
import type { FastifyReply } from 'fastify';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { ErrorBody } from './error.types';
import { toErrorBody } from './error-body.mapper';

/**
 * Global exception filter. Sanitizes every thrown value into a safe body and
 * logs it: 5xx as `error` (with the original exception for the server-side log),
 * 4xx as `warn`. Nothing sensitive reaches the client. See rules/18.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AppExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const body = toErrorBody(exception);
    this.record(body, exception);
    reply.status(body.statusCode).send(body);
  }

  private record(body: ErrorBody, exception: unknown): void {
    if (body.statusCode >= SERVER_ERROR_MIN_STATUS) {
      this.logger.error(
        {
          statusCode: body.statusCode,
          messageKey: body.messageKey,
          err: exception,
        },
        body.message,
      );
      return;
    }

    this.logger.warn(
      { statusCode: body.statusCode, messageKey: body.messageKey },
      body.message,
    );
  }
}
