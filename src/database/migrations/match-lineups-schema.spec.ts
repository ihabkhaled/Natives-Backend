import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { MatchLineupsSchema1723700000000 } from './1723700000000-match-lineups-schema';

function runner(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new MatchLineupsSchema1723700000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('MatchLineupsSchema1723700000000', () => {
  it('creates the two additive point tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"match_play_events"');
    expect(statements).toContain('"match_point_lineups"');
  });

  it('adds opponent-error attribution to the VERSIONED ruleset', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      'ADD COLUMN "opponent_error_attribution" boolean NOT NULL',
    );
    expect(statements).toContain('DEFAULT false');
  });

  it('constrains the point stream to the full event grammar', async () => {
    const statements = await upStatements();
    for (const playType of [
      'point_started',
      'point_completed',
      'pull',
      'throw',
      'completion',
      'goal',
      'drop',
      'throwaway',
      'block',
      'stall',
      'call',
      'turnover',
      'substitution',
      'opponent_drop',
      'opponent_throwaway',
      'correction',
    ]) {
      expect(statements).toContain(`'${playType}'`);
    }
    expect(statements).toContain('"ck_play_type"');
  });

  it('requires the line on a start and the side on a completion', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      `"play_type" <> 'point_started' OR "starting_line" IS NOT NULL`,
    );
    expect(statements).toContain(
      `"play_type" <> 'point_completed' OR "scoring_side" IS NOT NULL`,
    );
  });

  it('requires a target and a reason on every correction', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_play_correction"');
    expect(statements).toContain('"corrects_play_id" IS NOT NULL');
    expect(statements).toContain('"correction_reason" IS NOT NULL');
    expect(statements).toContain('"ux_plays_correction_target"');
  });

  it('makes the client operation id unique per match', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_plays_match_operation"');
    expect(statements).toContain('"match_id", "operation_id"');
  });

  it('keeps the point sequence unique and every fact append-only', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_plays_match_sequence"');
    expect(statements).toContain('"rl_match_play_events_immutable"');
    expect(statements).toContain(
      'ON UPDATE TO "match_play_events" DO INSTEAD NOTHING',
    );
    expect(statements).toContain(
      'ON UPDATE TO "match_point_lineups" DO INSTEAD NOTHING',
    );
  });

  it('constrains a recorded assist to name the player it credits', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ck_play_assist_link"');
    expect(statements).toContain(
      `"assist_state" <> 'recorded' OR\n           "secondary_membership_id" IS NOT NULL`,
    );
    expect(statements).toContain(`'recorded', 'none', 'unknown'`);
  });

  it('keeps an unmeasured point length nullable rather than zero', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"duration_seconds" integer,');
    expect(statements).toContain(
      '"duration_seconds" IS NULL OR "duration_seconds" >= 0',
    );
  });

  it('lists each player at most once per line and one puller per point', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_lineups_play_membership"');
    expect(statements).toContain('"ux_lineups_play_puller"');
    expect(statements).toContain('WHERE "puller" = true');
  });

  it('ties a lineup row to its point-start fact and roster entry', async () => {
    const statements = await upStatements();
    expect(statements).toContain(
      '"play_id" uuid NOT NULL REFERENCES "match_play_events" ("id")',
    );
    expect(statements).toContain(
      '"roster_entry_id" uuid REFERENCES "roster_entries" ("id")',
    );
  });

  it('closes the point stream of a finalized or abandoned match', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"fn_match_plays_closed_stream"');
    expect(statements).toContain('"tg_match_plays_closed_stream"');
    expect(statements).toContain(
      `current_status IN ('finalized', 'abandoned')`,
    );
  });

  it('stores no statistic — the projection has no totals table', async () => {
    const statements = await upStatements();
    expect(statements).not.toContain('"match_statistics"');
    expect(statements).not.toContain('"player_match_stats"');
  });

  it('grants no new permission — the RBAC baseline already bundles match.*', async () => {
    const queryRunner = runner();
    await new MatchLineupsSchema1723700000000().up(
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
    await new MatchLineupsSchema1723700000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    expect(statements[0]).toContain('"tg_match_plays_closed_stream"');
    expect(statements[1]).toContain('"fn_match_plays_closed_stream"');
    expect(
      statements.filter(statement => statement.startsWith('DROP TABLE')),
    ).toEqual([
      'DROP TABLE IF EXISTS "match_point_lineups"',
      'DROP TABLE IF EXISTS "match_play_events"',
    ]);
    expect(statements[4]).toContain(
      'DROP COLUMN IF EXISTS "opponent_error_attribution"',
    );
  });
});
