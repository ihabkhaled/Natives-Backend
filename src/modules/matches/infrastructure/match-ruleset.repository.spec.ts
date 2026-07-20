import { describe, expect, it, vi } from 'vitest';

import { RulesetStatus } from '../model/matches.enums';
import type { MatchRulesetRow } from '../model/matches.rows';
import type { NewMatchRuleset } from '../model/matches.types';
import { MatchRulesetRepository } from './match-ruleset.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');

function row(overrides: Partial<MatchRulesetRow> = {}): MatchRulesetRow {
  return {
    id: 'rules-1',
    team_id: 'team-1',
    season_id: null,
    ruleset_key: 'wfdf-indoor',
    ruleset_version: 1,
    name: 'Indoor',
    game_to: 15,
    win_by: 1,
    hard_cap: null,
    soft_cap_minutes: null,
    soft_cap_plus: null,
    time_cap_minutes: null,
    halftime_at: null,
    timeouts_per_team: 2,
    timeouts_per_period: null,
    periods: 2,
    status: 'active',
    notes: null,
    created_by: 'user-1',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function newRuleset(): NewMatchRuleset {
  return {
    id: 'rules-1',
    teamId: 'team-1',
    seasonId: null,
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 1,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: null,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: null,
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    notes: null,
    createdBy: 'user-1',
    now: NOW,
  };
}

describe('MatchRulesetRepository', () => {
  it('inserts a new version as active with bound parameters', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const ruleset = await new MatchRulesetRepository().insert(
      { run },
      newRuleset(),
    );
    expect(ruleset.status).toBe(RulesetStatus.Active);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'INSERT INTO "match_rulesets"',
    );
    expect(run.mock.calls[0]?.[1]).toEqual([
      'rules-1',
      'team-1',
      null,
      'wfdf-indoor',
      1,
      'Indoor',
      15,
      1,
      null,
      null,
      null,
      null,
      null,
      2,
      null,
      2,
      null,
      'user-1',
      NOW.toISOString(),
    ]);
  });

  it('raises when the insert returns nothing', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await expect(
      new MatchRulesetRepository().insert({ run }, newRuleset()),
    ).rejects.toThrow('Expected a returned row from the ruleset write');
  });

  it('archives the previously active version of a key', async () => {
    const run = vi.fn().mockResolvedValue([]);
    await new MatchRulesetRepository().archiveActive(
      { run },
      'team-1',
      'wfdf-indoor',
      NOW,
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(`"status" = 'archived'`);
    expect(run.mock.calls[0]?.[1]).toEqual([
      'team-1',
      'wfdf-indoor',
      NOW.toISOString(),
    ]);
  });

  it('resolves a ruleset only inside its own team', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const ruleset = await new MatchRulesetRepository().findById(
      { run },
      'team-1',
      'rules-1',
    );
    expect(ruleset?.rulesetId).toBe('rules-1');
    expect(run.mock.calls[0]?.[1]).toEqual(['rules-1', 'team-1']);
  });

  it('returns null for a ruleset another team owns', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchRulesetRepository().findById({ run }, 'team-2', 'rules-1'),
    ).toBeNull();
  });

  it('resolves the active version of a named key', async () => {
    const run = vi.fn().mockResolvedValue([row({ ruleset_version: 3 })]);
    const ruleset = await new MatchRulesetRepository().findActiveByKey(
      { run },
      'team-1',
      'wfdf-indoor',
    );
    expect(ruleset?.rulesetVersion).toBe(3);
    expect(String(run.mock.calls[0]?.[0])).toContain(`"status" = 'active'`);
  });

  it('returns null when a key has no active version', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchRulesetRepository().findActiveByKey(
        { run },
        'team-1',
        'missing',
      ),
    ).toBeNull();
  });

  it('resolves the team default active ruleset deterministically', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const ruleset = await new MatchRulesetRepository().findDefaultActive(
      { run },
      'team-1',
    );
    expect(ruleset?.rulesetId).toBe('rules-1');
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "created_at" ASC, "id" ASC',
    );
  });

  it('returns null when a team has published no ruleset at all', async () => {
    const run = vi.fn().mockResolvedValue([]);
    expect(
      await new MatchRulesetRepository().findDefaultActive({ run }, 'team-1'),
    ).toBeNull();
  });

  it('starts a brand-new key at version one and increments an existing one', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ value: null }])
      .mockResolvedValueOnce([{ value: '4' }])
      .mockResolvedValueOnce([]);
    const repository = new MatchRulesetRepository();
    expect(await repository.nextVersion({ run }, 'team-1', 'k')).toBe(1);
    expect(await repository.nextVersion({ run }, 'team-1', 'k')).toBe(5);
    expect(await repository.nextVersion({ run }, 'team-1', 'k')).toBe(1);
  });

  it('lists a bounded page grouped by key, newest version first', async () => {
    const run = vi.fn().mockResolvedValue([row()]);
    const items = await new MatchRulesetRepository().listForTeam(
      { run },
      'team-1',
      { limit: 900, offset: 10 },
    );
    expect(items).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "ruleset_key" ASC, "ruleset_version" DESC, "id" ASC',
    );
    expect(run.mock.calls[0]?.[1]).toEqual(['team-1', 100, 10]);
  });

  it('counts the team rulesets and tolerates an empty result', async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([]);
    const repository = new MatchRulesetRepository();
    expect(await repository.countForTeam({ run }, 'team-1')).toBe(2);
    expect(await repository.countForTeam({ run }, 'team-1')).toBe(0);
  });
});
