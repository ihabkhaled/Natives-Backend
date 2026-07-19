'use strict';

// Vercel serverless entrypoint for the NestJS + Fastify backend.
//
// Vercel runs functions, not long-running servers, so this file does NOT call
// app.listen(). It boots the Nest app once per warm instance, runs pending
// migrations, seeds the admin only on a fresh database, then forwards each
// incoming request into the underlying Fastify HTTP server.
//
// It imports the COMPILED output in ../dist (produced by `npm run build`, whose
// `tsc-alias` step rewrites the @app/@config/... path aliases to relative
// requires) so decorator metadata is emitted by tsc, not stripped by esbuild.

require('reflect-metadata');

const { createConfiguredApp } = require('../dist/src/bootstrap/bootstrap');
const { DATA_SOURCE } = require('../dist/src/database/database.constants');
const { runSeedAdmin } = require('../dist/src/database/seeds/seed-admin');
const { loadSeedAdminConfig } = require('../dist/src/config/seed-admin.config');
const { PASSWORD_HASH_PORT } = require('../dist/src/modules/auth');

let serverPromise;

// Run migrations (idempotent) and seed the admin ONLY when the database is
// empty, so seeds never re-run on every cold start. Disable with DB_BOOTSTRAP=false.
async function bootstrapDatabase(app) {
  if (process.env.DB_BOOTSTRAP === 'false') {
    return;
  }

  const dataSource = app.get(DATA_SOURCE, { strict: false });
  if (!dataSource || !dataSource.isInitialized) {
    return;
  }

  await dataSource.runMigrations();

  const rows = await dataSource.query('SELECT COUNT(*)::int AS count FROM "users"');
  const userCount = Number(rows && rows[0] ? rows[0].count : 0);
  if (userCount === 0) {
    const passwordHash = app.get(PASSWORD_HASH_PORT, { strict: false });
    await runSeedAdmin(dataSource, passwordHash, loadSeedAdminConfig());
  }
}

async function createServer() {
  const app = await createConfiguredApp();
  await app.init();
  await bootstrapDatabase(app);

  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return fastify.server;
}

module.exports = (req, res) => {
  if (!serverPromise) {
    serverPromise = createServer();
  }

  serverPromise
    .then((server) => {
      server.emit('request', req, res);
    })
    .catch((error) => {
      // Reset so the next invocation retries a fresh boot instead of caching a failure.
      serverPromise = undefined;
      // eslint-disable-next-line no-console
      console.error('Serverless bootstrap failed', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
};
