// Build-time database bootstrap for Vercel deploys (runs in buildCommand,
// after `npm run build`, so it uses the compiled dist output).
//
//   1. Applies pending TypeORM migrations (recorded in the `migrations` table,
//      so already-applied ones never re-run).
//   2. Seeds the administrator ONLY when the users table is empty — a fresh
//      database — so seeding never repeats on later deploys.
//
// Build runs once per deploy (no concurrency), which also removes any
// cold-start migration race at runtime. Skips gracefully when no database
// env is configured (e.g. preview builds without a DB).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');

const hasDatabaseConfig = Boolean(
  process.env.DATABASE_URL ?? process.env.DB_HOST,
);
if (!hasDatabaseConfig) {
  console.warn(
    '[bootstrap-db] DATABASE_URL/DB_HOST not set — skipping migrations and seed.',
  );
  process.exit(0);
}

const dataSource =
  require('../../dist/src/database/cli-data-source.js').default;

await dataSource.initialize();
const applied = await dataSource.runMigrations();
console.log(`[bootstrap-db] applied ${applied.length} pending migration(s)`);

const rows = await dataSource.query(
  'SELECT COUNT(*)::int AS count FROM "users"',
);
const freshDatabase = Number(rows[0]?.count ?? 0) === 0;
await dataSource.destroy();

if (!freshDatabase) {
  console.log('[bootstrap-db] database already seeded — skipping seed.');
  process.exit(0);
}

console.log('[bootstrap-db] fresh database detected — seeding administrator…');
const seed = spawnSync(
  process.execPath,
  ['-r', 'dotenv/config', 'dist/src/database/seeds/seed-admin.cli.js'],
  { stdio: 'inherit' },
);
process.exit(seed.status ?? 1);
