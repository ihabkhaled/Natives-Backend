import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { GovernanceSchema1724200000000 } from './1724200000000-governance-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new GovernanceSchema1724200000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('GovernanceSchema1724200000000', () => {
  it('creates the seven additive tables', async () => {
    const statements = await upStatements();
    for (const table of [
      'team_rules',
      'rule_acknowledgements',
      'discipline_cases',
      'governance_positions',
      'governance_appointments',
      'governance_meetings',
      'governance_tasks',
    ]) {
      expect(statements).toContain(`"${table}"`);
    }
  });

  it('keeps rules immutable and enforces discipline separation of duties', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rl_team_rules_immutable"');
    expect(statements).toContain('"ck_case_reviewer_sod"');
    expect(statements).toContain('"reviewed_by" <> "opened_by"');
  });

  it('keeps at most one active substantive appointment per position', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_appointments_active_position"');
    expect(statements).toContain(`"acting" = false`);
  });

  it('drops every table on down in dependency order', async () => {
    const queryRunner = runner();
    await new GovernanceSchema1724200000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "governance_tasks"');
    expect(statements).toContain('DROP TABLE IF EXISTS "team_rules"');
  });
});
