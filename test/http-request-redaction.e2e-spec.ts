import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';

import type { AppConfig } from '@config/config.types';
import { buildPinoHttpOptions } from '@core/logger/http-logging.options';
import { REDACT_CENSOR } from '@core/logger/logger.constants';
import { LogLevel, NodeEnv } from '@shared/enums';
import { pinoHttp } from 'pino-http';
import { describe, expect, it } from 'vitest';

const INVITATION_TOKEN = 'opaque-invitation-token-value';
const REFERRER_INVITATION_TOKEN = 'frontend-query-invitation-token-value';
const CALENDAR_FEED_TOKEN = 'opaque-calendar-feed-token-value';
const TEST_CONFIG: AppConfig = {
  nodeEnv: NodeEnv.Test,
  port: 0,
  name: 'logger-e2e',
  globalPrefix: 'api/v1',
  swaggerEnabled: false,
  logLevel: LogLevel.Info,
};

describe('HTTP request logging redaction (e2e)', () => {
  it('logs a useful request record without the public invitation token', async () => {
    const output: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        output.push(String(chunk));
        callback();
      },
    });
    const logger = pinoHttp(buildPinoHttpOptions(TEST_CONFIG), sink);
    const server = createServer((request, response) => {
      logger(request, response);
      response.statusCode = 200;
      response.end();
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${String(address.port)}/api/v1/auth/invitations/${INVITATION_TOKEN}`,
        {
          headers: {
            Referer: `https://app.example.test/accept-invitation?token=${REFERRER_INVITATION_TOKEN}`,
          },
        },
      );
      expect(response.status).toBe(200);
      const calendarResponse = await fetch(
        `http://127.0.0.1:${String(address.port)}/api/v1/calendar/feeds/${CALENDAR_FEED_TOKEN}.ics`,
      );
      expect(calendarResponse.status).toBe(200);

      const serialized = output.join('');
      expect(serialized).not.toContain(INVITATION_TOKEN);
      expect(serialized).not.toContain(REFERRER_INVITATION_TOKEN);
      expect(serialized).not.toContain(CALENDAR_FEED_TOKEN);
      expect(serialized).toContain(`/api/v1/auth/invitations/${REDACT_CENSOR}`);
      expect(serialized).toContain(
        `/api/v1/calendar/feeds/${REDACT_CENSOR}.ics`,
      );
      expect(serialized).toContain(`"referer":"${REDACT_CENSOR}"`);
      expect(serialized).toContain('"method":"GET"');
      expect(serialized).toMatch(/"id":(?:\d+|"[^"]+")/u);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error === undefined) {
            resolve();
            return;
          }
          reject(error);
        });
      });
    }
  });
});
