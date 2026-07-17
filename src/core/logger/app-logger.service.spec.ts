import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { AppLogger } from './app-logger.service';

function createPinoLogger(): PinoLogger {
  return {
    setContext: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as PinoLogger;
}

describe('AppLogger', () => {
  it('delegates setContext to the vendor logger', () => {
    const pinoLogger = createPinoLogger();
    new AppLogger(pinoLogger).setContext('Test');

    expect(pinoLogger.setContext).toHaveBeenCalledWith('Test');
  });

  it('logs message-only calls without a context object', () => {
    const pinoLogger = createPinoLogger();
    const logger = new AppLogger(pinoLogger);

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(pinoLogger.debug).toHaveBeenCalledWith('d');
    expect(pinoLogger.info).toHaveBeenCalledWith('i');
    expect(pinoLogger.warn).toHaveBeenCalledWith('w');
    expect(pinoLogger.error).toHaveBeenCalledWith('e');
  });

  it('passes the context object first in the vendor call order', () => {
    const pinoLogger = createPinoLogger();
    const logger = new AppLogger(pinoLogger);
    const context = { requestId: 'r1' };

    logger.debug('d', context);
    logger.info('i', context);
    logger.warn('w', context);
    logger.error('e', context);

    expect(pinoLogger.debug).toHaveBeenCalledWith(context, 'd');
    expect(pinoLogger.info).toHaveBeenCalledWith(context, 'i');
    expect(pinoLogger.warn).toHaveBeenCalledWith(context, 'w');
    expect(pinoLogger.error).toHaveBeenCalledWith(context, 'e');
  });

  it('redacts nested sensitive context before calling the vendor', () => {
    const pinoLogger = createPinoLogger();
    const logger = new AppLogger(pinoLogger);

    logger.error('failed', {
      requestId: 'request-1',
      nested: { accessToken: 'secret-token' },
    });

    expect(pinoLogger.error).toHaveBeenCalledWith(
      {
        requestId: 'request-1',
        nested: { accessToken: '[Redacted]' },
      },
      'failed',
    );
  });
});
