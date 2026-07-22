import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { StandingsSchema1724000000000 } from './1724000000000-standings-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new StandingsSchema1724000000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('StandingsSchema1724000000000', () => {
  it('creates the three additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"standings_rule_versions"');
    expect(statements).toContain('"competition_standings"');
    expect(statements).toContain('"team_achievements"');
  });

  it('keeps rule versions immutable at the database level', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rl_standings_rule_versions_immutable"');
    expect(statements).toContain('DO INSTEAD NOTHING');
  });

  it('keeps an unscored spirit score nullable rather than zero', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      '"spirit_score" IS NULL OR ("spirit_score" >= 0',
    );
  });

  it('requires a reconciliation note for a non-derived row', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      `"source" = 'derived' OR "reconciliation_note" IS NOT NULL`,
    );
  });

  it('makes the achievement import reference unique per team', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_achievements_import_reference"');
  });

  it('drops every table on down', async () => {
    const queryRunner = runner();
    await new StandingsSchema1724000000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "team_achievements"');
    expect(statements).toContain(
      'DROP TABLE IF EXISTS "standings_rule_versions"',
    );
  });
});
