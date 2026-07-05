import type { ArgumentsHost } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { AppExceptionFilter } from './app-exception.filter';
import { NotFoundError } from './not-found.error';

function createHost(reply: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;
}

describe('AppExceptionFilter', () => {
  const logger = { error: vi.fn(), warn: vi.fn() } as unknown as PinoLogger;
  const filter = new AppExceptionFilter(logger);

  it('logs a 4xx as warn and sends the sanitized body', () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    filter.catch(
      new NotFoundError('missing', 'errors.article.notFound'),
      createHost(reply),
    );

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        messageKey: 'errors.article.notFound',
      }),
    );
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a 5xx as error', () => {
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };

    filter.catch(new Error('boom'), createHost(reply));

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalled();
  });
});
