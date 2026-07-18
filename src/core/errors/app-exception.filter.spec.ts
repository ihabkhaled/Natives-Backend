import type { AppLogger } from '@core/logger';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AppExceptionFilter } from './app-exception.filter';
import { NotFoundError } from './not-found.error';

function createHost(reply: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;
}

function createLogger(): AppLogger {
  return {
    setContext: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as AppLogger;
}

describe('AppExceptionFilter', () => {
  it('logs a 4xx as warn and sends the sanitized body', () => {
    const logger = createLogger();
    const filter = new AppExceptionFilter(logger);
    const reply = {
      header: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    filter.catch(
      new NotFoundError('missing', 'errors.article.notFound'),
      createHost(reply),
    );

    expect(reply.header).toHaveBeenCalledWith(
      'Content-Type',
      'application/json; charset=utf-8',
    );
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        messageKey: 'errors.article.notFound',
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith('missing', {
      statusCode: 404,
      messageKey: 'errors.article.notFound',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a 5xx as error with the original exception attached', () => {
    const logger = createLogger();
    const filter = new AppExceptionFilter(logger);
    const reply = {
      header: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    const boom = new Error('boom');

    filter.catch(boom, createHost(reply));

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(logger.error).toHaveBeenCalledWith(
      'Internal server error',
      expect.objectContaining({ statusCode: 500, err: boom }),
    );
  });
});
