import type { AppConfig } from '@config/config.types';
import {
  CLIENT_ERROR_MIN_STATUS,
  SERVER_ERROR_MIN_STATUS,
} from '@shared/constants';
import { NodeEnv } from '@shared/enums';
import type { Level } from 'pino';
import type { Options } from 'pino-http';

import {
  DEV_LOG_TRANSPORT,
  REDACT_CENSOR,
  REDACT_PATHS,
} from './logger.constants';

function levelForStatus(statusCode: number): Level {
  if (statusCode >= SERVER_ERROR_MIN_STATUS) {
    return 'error';
  }
  if (statusCode >= CLIENT_ERROR_MIN_STATUS) {
    return 'warn';
  }
  return 'info';
}

// Every request/response is logged by pino-http; error responses (4xx/5xx) are
// escalated to warn/error so failures are never silent (rules/14).
export function buildPinoHttpOptions(app: AppConfig): Options {
  const options: Options = {
    level: app.logLevel,
    autoLogging: true,
    redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
    customLogLevel: (_request, response, error) =>
      error === undefined ? levelForStatus(response.statusCode) : 'error',
  };

  if (app.nodeEnv === NodeEnv.Development) {
    return { ...options, transport: DEV_LOG_TRANSPORT };
  }

  return options;
}
