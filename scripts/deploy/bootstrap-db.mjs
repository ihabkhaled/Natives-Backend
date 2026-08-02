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
await dataSource.destroy();

// Always run the seed CLI: it drives the WHOLE once-only registry (admin,
// team, personas, roster), and each seeder no-ops via its `seed_history` row.
// The old "skip when users exist" gate is exactly the bug it looks like — a
// database seeded before a NEW seeder was added never received it, which is
// how a deploy ends up with an administrator but no roster.
console.log('[bootstrap-db] running the once-only seed registry…');
const seed = spawnSync(
  process.execPath,
  ['-r', 'dotenv/config', 'dist/src/database/seeds/seed-admin.cli.js'],
  { stdio: 'inherit' },
);
process.exit(seed.status ?? 1);
