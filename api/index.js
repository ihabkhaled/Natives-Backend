// Vercel serverless entrypoint.
//
// Vercel executes functions, not long-lived servers, so it needs a module that
// EXPORTS a request handler. It must also stay plain JavaScript: when Vercel
// compiles TypeScript itself it does not apply this repository's tsconfig path
// aliases (@app/*, @core/*, ...), which is why compiling src/main.ts directly
// failed with "Cannot find module '@app/bootstrap/bootstrap'".
//
// This file therefore requires the ALREADY-BUILT output in dist/, where
// `tsc-alias` has rewritten every alias to a relative path.
//
// `createConfiguredApp()` assembles the app (security, validation, lifecycle,
// Swagger, CORS) WITHOUT listening and WITHOUT running the boot database
// lifecycle — migrations/seeding run once at build time via
// scripts/deploy/bootstrap-db.mjs, not on every cold start.

let cachedServer = null;

async function getServer() {
  if (cachedServer !== null) {
    return cachedServer;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createConfiguredApp } = require('../dist/src/bootstrap/bootstrap');

  const app = await createConfiguredApp();
  await app.init();

  // Fastify must be ready before we hand raw Node req/res to its server.
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();

  cachedServer = fastify.server;
  return cachedServer;
}

module.exports = async function handler(request, response) {
  const server = await getServer();
  server.emit('request', request, response);
};
