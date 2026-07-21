import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { REQUEST_ID_HEADER } from './bootstrap.constants';

/**
 * Echo the request's correlation id on every response.
 *
 * Fastify already assigns `request.id` (from the incoming `x-request-id` when
 * the client supplies one, otherwise a fresh UUID from `genReqId`) and logs it,
 * but it never puts it on the wire — so a browser, a support ticket and the
 * server logs had no shared identifier. This hook adds it to every response,
 * including error responses, and `CORS_EXPOSED_HEADERS` makes it readable
 * cross-origin. Transport-level concern, hence bootstrap: no route, guard or
 * service is involved.
 */
export function registerCorrelationHeader(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      void reply.header(REQUEST_ID_HEADER, request.id);
      done();
    });
}
