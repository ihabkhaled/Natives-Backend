import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { ActivitiesSchema1722900000000 } from './1722900000000-activities-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new ActivitiesSchema1722900000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('ActivitiesSchema1722900000000', () => {
  it('creates the catalog, submission, evidence, and buddy tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"activity_types"');
    expect(statements).toContain('"activity_submissions"');
    expect(statements).toContain('"activity_evidence"');
    expect(statements).toContain('"activity_buddies"');
    expect(statements).toContain('"default_point_value" numeric');
    expect(statements).toContain('"duration_minutes" integer');
    expect(statements).toContain('"storage_reference" text NOT NULL');
  });

  it('guards duplicate live claims and duplicate evidence', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_activity_submission_dedupe"');
    expect(statements).toContain(
      `"status" NOT IN ('withdrawn', 'rejected', 'reversed')`,
    );
    expect(statements).toContain('"ux_activity_evidence_reference"');
    expect(statements).toContain('"ux_activity_buddy_once"');
  });

  it('constrains every enum column and keeps WFDF points pending', async () => {
    const statements = await upStatements();
    for (const status of [
      'draft',
      'submitted',
      'under_review',
      'changes_requested',
      'approved',
      'rejected',
      'withdrawn',
      'reversed',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
    expect(statements).toContain('ck_activity_type_pending_points');
    expect(statements).toContain('ck_activity_buddy_status');
    expect(statements).toContain('ck_activity_evidence_kind');
  });

  it('seeds the configurable legacy point candidates', async () => {
    const queryRunner = runner();
    await new ActivitiesSchema1722900000000().up(
      queryRunner as never as QueryRunner,
    );
    const seedParams = queryRunner.query.mock.calls
      .map(call => call[1])
      .filter((params): params is unknown[] => Array.isArray(params));
    const byKey = new Map(
      seedParams.map(params => [params[0], params[5]] as const),
    );
    expect(byKey.get('gym')).toBe(2);
    expect(byKey.get('running')).toBe(2);
    expect(byKey.get('throwing')).toBe(4);
    expect(byKey.get('pickup')).toBe(2);
    expect(byKey.get('another_sport')).toBe(1);
    expect(byKey.get('team_drills')).toBe(2);
    expect(byKey.get('rules_quiz')).toBe(2);
    expect(byKey.get('wfdf_accreditation')).toBeNull();
  });

  it('drops only this additive schema in dependency order', async () => {
    const queryRunner = runner();
    await new ActivitiesSchema1722900000000().down(
      queryRunner as never as QueryRunner,
    );
    expect(queryRunner.query.mock.calls.map(call => call[0])).toEqual([
      'DROP TABLE IF EXISTS "activity_buddies"',
      'DROP TABLE IF EXISTS "activity_evidence"',
      'DROP TABLE IF EXISTS "activity_submissions"',
      'DROP TABLE IF EXISTS "activity_types"',
    ]);
  });
});
