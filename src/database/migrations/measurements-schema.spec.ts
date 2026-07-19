import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { MeasurementsSchema1722800000000 } from './1722800000000-measurements-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('MeasurementsSchema1722800000000', () => {
  it('creates the protocol, session, and attempt tables and seeds the catalog', async () => {
    const queryRunner = runner();
    await new MeasurementsSchema1722800000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('"measurement_protocols"');
    expect(statements).toContain('"measurement_sessions"');
    expect(statements).toContain('"measurement_attempts"');
    expect(statements).toContain('"ux_measurement_protocol_key"');
    expect(statements).toContain('WHERE "status" = \'active\'');
    expect(statements).toContain('"ux_measurement_attempt_ordinal"');
    expect(statements).toContain("'sprint_20m'");
    expect(statements).toContain("'vertical_jump'");
  });

  it('enforces null-not-zero and enum check constraints', async () => {
    const queryRunner = runner();
    await new MeasurementsSchema1722800000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');
    expect(statements).toContain('ck_measurement_attempt_null_not_zero');
    expect(statements).toContain(
      '("raw_value" IS NULL) = ("canonical_value" IS NULL)',
    );
    for (const direction of ['better_higher', 'better_lower']) {
      expect(statements).toContain(`'${direction}'`);
    }
    for (const status of ['scheduled', 'conducted', 'cancelled']) {
      expect(statements).toContain(`'${status}'`);
    }
  });

  it('drops only this additive schema in dependency order', async () => {
    const queryRunner = runner();
    await new MeasurementsSchema1722800000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "measurement_attempts"',
      'DROP TABLE IF EXISTS "measurement_sessions"',
      'DROP TABLE IF EXISTS "measurement_protocols"',
    ]);
  });
});
