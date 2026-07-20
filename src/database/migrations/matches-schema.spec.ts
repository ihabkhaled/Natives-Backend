import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { MatchesSchema1723600000000 } from './1723600000000-matches-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new MatchesSchema1723600000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('MatchesSchema1723600000000', () => {
  it('creates the four additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"match_rulesets"');
    expect(statements).toContain('"matches"');
    expect(statements).toContain('"match_events"');
    expect(statements).toContain('"match_revisions"');
  });

  it('constrains the match lifecycle to the full state machine', async () => {
    const statements = await upStatements();
    for (const status of [
      'scheduled',
      'ready',
      'live',
      'paused',
      'halftime',
      'completed',
      'finalized',
      'abandoned',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
    expect(statements).toContain('"ck_match_status"');
  });

  it('keeps every unconfigured cap nullable rather than zero', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      '"hard_cap" IS NULL OR "hard_cap" >= "game_to"',
    );
    expect(statements).toContain(
      '"soft_cap_minutes" IS NULL OR "soft_cap_minutes" > 0',
    );
    expect(statements).toContain(
      '"time_cap_minutes" IS NULL OR "time_cap_minutes" > 0',
    );
    expect(statements).toContain('"halftime_at" IS NULL OR "halftime_at" > 0');
  });

  it('versions a ruleset key and keeps at most one active version', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_rulesets_team_key_version"');
    expect(statements).toContain('"ux_rulesets_team_key_active"');
    expect(statements).toContain(`WHERE "status" = 'active'`);
  });

  it('allows only one non-abandoned match per fixture', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_matches_fixture_live"');
    expect(statements).toContain(`WHERE "status" <> 'abandoned'`);
  });

  it('requires a reason to abandon and a stamp to finalize', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      `"status" <> 'abandoned' OR "abandon_reason" IS NOT NULL`,
    );
    expect(statements).toContain(
      `"status" <> 'finalized' OR "finalized_at" IS NOT NULL`,
    );
    expect(statements).toContain(
      '"reopened_at" IS NULL OR "reopen_reason" IS NOT NULL',
    );
  });

  it('constrains the score projection and the optimistic versions', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"our_score" >= 0 AND "opponent_score" >= 0');
    expect(statements).toContain('"ck_match_stream_version"');
    expect(statements).toContain('"ck_match_record_version"');
    expect(statements).toContain('"ck_match_revision"');
  });

  it('makes the client operation id unique per match', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_events_match_operation"');
    expect(statements).toContain('"match_id", "operation_id"');
  });

  it('keeps the stream sequence unique and every fact append-only', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_events_match_sequence"');
    expect(statements).toContain('"rl_match_events_immutable"');
    expect(statements).toContain(
      'ON UPDATE TO "match_events" DO INSTEAD NOTHING',
    );
  });

  it('requires a target and a reason on every compensating void', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_event_void_target"');
    expect(statements).toContain('"voids_event_id" IS NOT NULL');
    expect(statements).toContain('"void_reason" IS NOT NULL');
    expect(statements).toContain('"ux_events_void_target"');
  });

  it('requires a scoring side on every point event', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_event_point_side"');
    expect(statements).toContain(
      `"event_type" <> 'point' OR "scoring_side" IS NOT NULL`,
    );
  });

  it('makes the correction trail immutable at the database level', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"rl_match_revisions_immutable"');
    expect(statements).toContain(
      'ON UPDATE TO "match_revisions" DO INSTEAD NOTHING',
    );
    expect(statements).toContain('"ux_revisions_match_revision_action"');
    expect(statements).toContain('"ux_revisions_match_sequence"');
  });

  it('rejects every in-place edit of a finalized match with a trigger', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"fn_matches_finalized_immutable"');
    expect(statements).toContain('"tg_matches_finalized_immutable"');
    expect(statements).toContain(
      `OLD."status" = 'finalized' AND NEW."revision" = OLD."revision"`,
    );
  });

  it('closes the stream of a finalized or abandoned match with a trigger', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"fn_match_events_closed_stream"');
    expect(statements).toContain('"tg_match_events_closed_stream"');
    expect(statements).toContain(
      `current_status IN ('finalized', 'abandoned')`,
    );
  });

  it('grants no new permission — the RBAC baseline already bundles match.*', async () => {
    const queryRunner = runner();
    await new MatchesSchema1723600000000().up(
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
    await new MatchesSchema1723600000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain('"tg_match_events_closed_stream"');
    expect(statements[1]).toContain('"tg_matches_finalized_immutable"');
    expect(
      statements.filter(statement => statement.startsWith('DROP TABLE')),
    ).toEqual([
      'DROP TABLE IF EXISTS "match_revisions"',
      'DROP TABLE IF EXISTS "match_events"',
      'DROP TABLE IF EXISTS "matches"',
      'DROP TABLE IF EXISTS "match_rulesets"',
    ]);
  });
});
