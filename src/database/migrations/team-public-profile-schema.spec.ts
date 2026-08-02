import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TeamPublicProfile1725900000000 } from './1725900000000-team-public-profile';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('TeamPublicProfile1725900000000', () => {
  it('adds nullable public-profile columns to teams', async () => {
    const queryRunner = runner();
    await new TeamPublicProfile1725900000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');

    expect(statements).toContain('ADD COLUMN "location" text');
    expect(statements).toContain('ADD COLUMN "founded_on" date');
    expect(statements).toContain('ADD COLUMN "facebook_url" text');
    expect(statements).toContain('ADD COLUMN "instagram_url" text');
    expect(statements).toContain('ADD COLUMN "tiktok_url" text');
    expect(statements).toContain('UPDATE "teams"');
    expect(statements).toContain('"location" IS NULL');
    const backfillParams = queryRunner.query.mock.calls[5]?.[1];
    expect(backfillParams).toEqual([
      'un',
      'El Sheikh Zayed, Giza, Egypt',
      '2021-10-01',
      'https://www.facebook.com/ultimatenatives',
      'https://www.instagram.com/ultimatenatives',
      'https://www.tiktok.com/@ultimate.natives',
    ]);
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new TeamPublicProfile1725900000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements).toEqual([
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "tiktok_url"`,
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "instagram_url"`,
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "facebook_url"`,
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "founded_on"`,
      `ALTER TABLE "teams" DROP COLUMN IF EXISTS "location"`,
    ]);
  });
});
