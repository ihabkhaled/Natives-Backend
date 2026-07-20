import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { SquadsSchema1723400000000 } from './1723400000000-squads-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new SquadsSchema1723400000000().up(queryRunner as never as QueryRunner);
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('SquadsSchema1723400000000', () => {
  it('creates the four additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"squads"');
    expect(statements).toContain('"squad_selections"');
    expect(statements).toContain('"squad_selection_events"');
    expect(statements).toContain('"squad_availability"');
  });

  it('constrains the squad status and availability to the enum sets', async () => {
    const statements = await upStatements();
    for (const status of ['draft', 'published', 'locked', 'archived']) {
      expect(statements).toContain(`'${status}'`);
    }
    for (const availability of ['available', 'unavailable', 'tentative']) {
      expect(statements).toContain(`'${availability}'`);
    }
  });

  it('bounds the attendance threshold to a percentage', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_squad_threshold"');
    expect(statements).toContain('<= 100');
  });

  it('enforces override consistency and one captain per squad', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_selection_override"');
    expect(statements).toContain('"ux_selections_squad_captain"');
    expect(statements).toContain(`"selection_role" = 'captain'`);
  });

  it('enforces one squad name per scope while live and one selection per member', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_squads_scope_name"');
    expect(statements).toContain('WHERE "deleted_at" IS NULL');
    expect(statements).toContain('"ux_selections_squad_member"');
    expect(statements).toContain('"ux_availability_squad_member"');
  });

  it('grants no new permission — the RBAC baseline already bundles squad.*', async () => {
    const queryRunner = runner();
    await new SquadsSchema1723400000000().up(
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
    await new SquadsSchema1723400000000().down(
      queryRunner as never as QueryRunner,
    );
    const dropStatements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .filter(statement => statement.startsWith('DROP TABLE'));
    expect(dropStatements).toEqual([
      'DROP TABLE IF EXISTS "squad_selection_events"',
      'DROP TABLE IF EXISTS "squad_availability"',
      'DROP TABLE IF EXISTS "squad_selections"',
      'DROP TABLE IF EXISTS "squads"',
    ]);
  });
});
