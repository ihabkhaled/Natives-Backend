import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { JerseysSchema1724300000000 } from './1724300000000-jerseys-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new JerseysSchema1724300000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('JerseysSchema1724300000000', () => {
  it('creates the six additive tables', async () => {
    const statements = await upStatements();
    for (const table of [
      'jersey_products',
      'number_reservations',
      'jersey_orders',
      'jersey_order_items',
      'jersey_inventory',
      'jersey_issues',
    ]) {
      expect(statements).toContain(`"${table}"`);
    }
  });

  it('never stores payment card data, only a coarse status', async () => {
    const statements = await upStatements();
    expect(statements).not.toMatch(/card_number|cvv|card_holder|pan/u);
    expect(statements).toContain('"ck_order_payment"');
  });

  it('scopes active number uniqueness and keeps released history', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_reservations_active_number"');
    expect(statements).toContain(`"status" = 'active'`);
    expect(statements).toContain('"ix_reservations_history"');
  });

  it('drops every table on down in dependency order', async () => {
    const queryRunner = runner();
    await new JerseysSchema1724300000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('DROP TABLE IF EXISTS "jersey_issues"');
    expect(statements).toContain('DROP TABLE IF EXISTS "jersey_products"');
  });
});
