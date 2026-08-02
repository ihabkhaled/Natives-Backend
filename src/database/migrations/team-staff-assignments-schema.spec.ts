import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { TeamStaffAssignments1725700000000 } from './1725700000000-team-staff-assignments';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

describe('TeamStaffAssignments1725700000000', () => {
  it('creates the team_staff_assignments table with its constraints and indexes', async () => {
    const queryRunner = runner();
    await new TeamStaffAssignments1725700000000().up(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .join('\n');

    expect(statements).toContain('CREATE TABLE "team_staff_assignments"');
    expect(statements).toContain(
      '"team_id" uuid NOT NULL REFERENCES "teams" ("id") ON DELETE CASCADE',
    );
    expect(statements).toContain(
      '"membership_id" uuid NOT NULL REFERENCES "memberships" ("id")',
    );
    expect(statements).toContain(
      '"title_entry_id" uuid NOT NULL REFERENCES "reference_catalog_entries" ("id")',
    );
    expect(statements).toContain('ON DELETE RESTRICT');
    expect(statements).toContain('"photo_url" text');
    expect(statements).toContain(
      `CONSTRAINT "ck_staff_assignment_status" CHECK ("status" IN\n          ('active', 'removed'))`,
    );
    expect(statements).toContain(
      'CREATE UNIQUE INDEX "ux_staff_assignments_active"',
    );
    expect(statements).toContain(
      'CREATE INDEX "ix_staff_assignments_team_status"',
    );
  });

  it('reverses exactly what it created', async () => {
    const queryRunner = runner();
    await new TeamStaffAssignments1725700000000().down(
      queryRunner as never as QueryRunner,
    );

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(String(queryRunner.query.mock.calls[0]?.[0])).toContain(
      'DROP TABLE IF EXISTS "team_staff_assignments"',
    );
  });
});
