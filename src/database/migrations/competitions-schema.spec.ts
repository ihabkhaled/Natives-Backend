import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

import { CompetitionsSchema1723300000000 } from './1723300000000-competitions-schema';

function runner() {
  return { query: vi.fn().mockResolvedValue(undefined) };
}

async function upStatements(): Promise<string> {
  const queryRunner = runner();
  await new CompetitionsSchema1723300000000().up(
    queryRunner as never as QueryRunner,
  );
  return queryRunner.query.mock.calls.map(call => String(call[0])).join('\n');
}

describe('CompetitionsSchema1723300000000', () => {
  it('creates the five additive tables', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"opponents"');
    expect(statements).toContain('"competitions"');
    expect(statements).toContain('"competition_stages"');
    expect(statements).toContain('"competition_rounds"');
    expect(statements).toContain('"fixtures"');
  });

  it('constrains the competition type and status to the enum sets', async () => {
    const statements = await upStatements();
    for (const type of [
      'league',
      'championship',
      'tournament',
      'friendly',
      'custom',
    ]) {
      expect(statements).toContain(`'${type}'`);
    }
    for (const status of [
      'draft',
      'published',
      'active',
      'completed',
      'cancelled',
      'archived',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
  });

  it('constrains the fixture status and side to the enum sets', async () => {
    const statements = await upStatements();
    for (const status of [
      'scheduled',
      'rescheduled',
      'ready',
      'live',
      'final',
      'abandoned',
    ]) {
      expect(statements).toContain(`'${status}'`);
    }
    expect(statements).toContain(`'home'`);
    expect(statements).toContain(`'away'`);
    expect(statements).toContain(`'neutral'`);
  });

  it('enforces one competition name per team and season while live', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_competitions_team_season_name"');
    expect(statements).toContain('WHERE "deleted_at" IS NULL');
  });

  it('orders stages and rounds with unique ordinals', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ux_stages_competition_ordinal"');
    expect(statements).toContain('"ux_rounds_stage_ordinal"');
  });

  it('indexes the fixtures team calendar and restricts opponent deletes', async () => {
    const statements = await upStatements();
    expect(statements).toContain('"ix_fixtures_team_calendar"');
    expect(statements).toContain('ON DELETE RESTRICT');
  });

  it('grants competition.manage to the coach and team_admin bundles', async () => {
    const queryRunner = runner();
    await new CompetitionsSchema1723300000000().up(
      queryRunner as never as QueryRunner,
    );
    const params = queryRunner.query.mock.calls.flatMap(call =>
      Array.isArray(call[1]) ? (call[1] as unknown[]) : [],
    );
    expect(params).toContain('COACH');
    expect(params).toContain('TEAM_ADMIN');
    expect(params).toContain('competition.manage');
  });

  it('reverses exactly what it created, in dependency order', async () => {
    const queryRunner = runner();
    await new CompetitionsSchema1723300000000().down(
      queryRunner as never as QueryRunner,
    );
    const dropStatements = queryRunner.query.mock.calls
      .map(call => String(call[0]))
      .filter(statement => statement.startsWith('DROP TABLE'));
    expect(dropStatements).toEqual([
      'DROP TABLE IF EXISTS "fixtures"',
      'DROP TABLE IF EXISTS "competition_rounds"',
      'DROP TABLE IF EXISTS "competition_stages"',
      'DROP TABLE IF EXISTS "competitions"',
      'DROP TABLE IF EXISTS "opponents"',
    ]);
  });

  it('revokes the manage grant before dropping tables', async () => {
    const queryRunner = runner();
    await new CompetitionsSchema1723300000000().down(
      queryRunner as never as QueryRunner,
    );
    const statements = queryRunner.query.mock.calls.map(call =>
      String(call[0]),
    );
    const firstDrop = statements.findIndex(statement =>
      statement.startsWith('DROP TABLE'),
    );
    const revoke = statements.findIndex(statement =>
      statement.startsWith('DELETE FROM "role_permissions"'),
    );
    expect(revoke).toBeGreaterThanOrEqual(0);
    expect(revoke).toBeLessThan(firstDrop);
  });
});
