import { randomUUID } from 'node:crypto';

import { FastifyAdapter } from '@nestjs/platform-fastify';

import { BODY_LIMIT_BYTES, TRUST_PROXY } from './bootstrap.constants';

// Builds the Fastify adapter: bounded body size, forwarded addresses disabled
// until trusted proxies are explicitly configured, and a correlated request id.
export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    bodyLimit: BODY_LIMIT_BYTES,
    trustProxy: TRUST_PROXY,
    genReqId: () => randomUUID(),
  });
}
