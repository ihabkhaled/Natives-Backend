import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { RostersSchema1723500000000 } from './1723500000000-rosters-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new RostersSchema1723500000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('RostersSchema1723500000000', () => {
  it('creates the four additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rosters"');
    expect(statements).toContain('"roster_entries"');
    expect(statements).toContain('"roster_availability"');
    expect(statements).toContain('"roster_snapshots"');
  });

  it('constrains the roster lifecycle and kind to the enum sets', async () => {
    const statements = await upStatements();
    for (const status of [
      'draft',
      'published',
      'locked',
      'revised',
      'archived',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
    expect(statements).toContain('"ck_roster_kind"');
    expect(statements).toContain(`'competition', 'match'`);
  });

  it('ties a fixture id to a match roster and forbids it on a competition one', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_roster_fixture"');
    expect(statements).toContain(
      `("roster_kind" = 'match') = ("fixture_id" IS NOT NULL)`,
    );
  });

  it('requires a reason on every superseded roster', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_roster_revision_reason"');
    expect(statements).toContain(
      `"status" <> 'revised' OR "revision_reason" IS NOT NULL`,
    );
  });

  it('allows only one live roster per competition and per fixture', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_rosters_competition_live"');
    expect(statements).toContain('"ux_rosters_fixture_live"');
    expect(statements).toContain(
      `"status" IN ('draft', 'published', 'locked')`,
    );
  });

  it('bounds the size window and keeps a null minimum-women rule allowed', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_roster_size"');
    expect(statements).toContain('"max_size" >= "min_size"');
    expect(statements).toContain('"min_women" IS NULL OR "min_women" >= 0');
  });

  it('enforces one entry per member, jersey uniqueness, and single captains', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_entries_roster_member"');
    expect(statements).toContain('"ux_entries_roster_jersey"');
    expect(statements).toContain(
      `WHERE "jersey_number" IS NOT NULL AND "status" = 'selected'`,
    );
    expect(statements).toContain('"ux_entries_roster_captain"');
    expect(statements).toContain('"ux_entries_roster_spirit_captain"');
  });

  it('requires an override reason whenever an entry is overridden', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_entry_override"');
    expect(statements).toContain(
      `NOT "constraint_overridden" OR "override_reason" IS NOT NULL`,
    );
  });

  it('keeps an undeclared entry availability nullable', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_entry_availability"');
    expect(statements).toContain('"availability" IS NULL OR');
  });

  it('makes a snapshot immutable at the database level', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rl_roster_snapshots_immutable"');
    expect(statements).toContain(
      'ON UPDATE TO "roster_snapshots" DO INSTEAD NOTHING',
    );
    expect(statements).toContain('"ux_snapshots_roster_revision_reason"');
  });

  it('links the roster to its current snapshot after both tables exist', async () => {
    const queryRunner = runner();
    await new RostersSchema1723500000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    const snapshotTable = statements.findIndex(statement =>
      statement.includes('CREATE TABLE "roster_snapshots"'),
    );
    const foreignKey = statements.findIndex(statement =>
      statement.includes('"fk_rosters_current_snapshot"'),
    );
    expect(snapshotTable).toBeGreaterThanOrEqual(0);
    expect(foreignKey).toBeGreaterThan(snapshotTable);
  });

  it('grants no new permission — the RBAC baseline already bundles roster.*', async () => {
    const queryRunner = runner();
    await new RostersSchema1723500000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(
      statements.some(statement =>
        statement.includes('INSERT INTO "role_permissions"'),
      ),
    ).toBe(false);
  });

  it('reverses exactly what it created, in dependency order', async () => {
    const queryRunner = runner();
    await new RostersSchema1723500000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain('"fk_rosters_current_snapshot"');
    expect(
      statements.filter(statement => statement.startsWith('DROP TABLE')),
    ).toEqual([
      'DROP TABLE IF EXISTS "roster_snapshots"',
      'DROP TABLE IF EXISTS "roster_availability"',
      'DROP TABLE IF EXISTS "roster_entries"',
      'DROP TABLE IF EXISTS "rosters"',
    ]);
  });
});
