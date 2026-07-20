import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Leaderboard read-path index (UN-403). Purely additive — it creates no table and
 * changes no column. The team leaderboard projects per-membership, per-category
 * point sums over a half-open UTC instant window (an Africa/Cairo calendar edge
 * stored UTC), so a covering index on `(team_id, created_at)` carrying the
 * membership, category, and amount lets those windowed aggregations resolve
 * without touching the heap and keeps the bounded cohort scan cheap.
 *
 * Fully reversible: `down` drops exactly the index `up` created. Proven from empty
 * by the leaderboard integration and e2e suites, which migrate a fresh database up
 * and then undo every migration.
 */
export class LeaderboardIndexes1723200000000 implements MigrationInterface {
  name = 'LeaderboardIndexes1723200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "ix_points_ledger_team_created"
         ON "points_ledger" ("team_id", "created_at")
         INCLUDE ("membership_id", "activity_category", "amount")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "ix_points_ledger_team_created"`,
    );
  }
}
