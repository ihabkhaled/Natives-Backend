import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchScopeNotFoundError } from '../errors/match-scope-not-found.error';
import type { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import { RulesetStatus } from '../model/matches.enums';
import type { MatchRuleset, MatchRulesetContent } from '../model/matches.types';
import { CreateMatchRulesetUseCase } from './create-match-ruleset.use-case';
import type { MatchScopeService } from './match-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'rules-2' };
const ACTOR: AuthUserIdentity = {
  userId: 'coach-1',
  email: 'coach@example.test',
  roles: [],
};

function content(
  overrides: Partial<MatchRulesetContent> = {},
): MatchRulesetContent {
  return {
    rulesetKey: 'wfdf-indoor',
    seasonId: null,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: 17,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: null,
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    notes: null,
    ...overrides,
  };
}

function ruleset(): MatchRuleset {
  return {
    rulesetId: 'rules-2',
    teamId: 'team-1',
    seasonId: null,
    rulesetKey: 'wfdf-indoor',
    rulesetVersion: 2,
    name: 'Indoor',
    gameTo: 15,
    winBy: 1,
    hardCap: 17,
    softCapMinutes: null,
    softCapPlus: null,
    timeCapMinutes: null,
    halftimeAt: null,
    timeoutsPerTeam: 2,
    timeoutsPerPeriod: null,
    periods: 2,
    status: RulesetStatus.Active,
    notes: null,
    createdBy: 'coach-1',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(options: { seasonOk?: boolean } = {}): {
  useCase: CreateMatchRulesetUseCase;
  archiveActive: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
} {
  const archiveActive = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockResolvedValue(ruleset());
  const rulesets = {
    archiveActive,
    insert,
    nextVersion: vi.fn().mockResolvedValue(2),
  } as unknown as MatchRulesetRepository;
  const scope = {
    requireSeason: vi.fn().mockImplementation(() => {
      if (options.seasonOk === false) {
        throw new MatchScopeNotFoundError();
      }
      return Promise.resolve(undefined);
    }),
  } as unknown as MatchScopeService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new CreateMatchRulesetUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      scope,
      rulesets,
      audit as unknown as AuditRecorderService,
    ),
    archiveActive,
    insert,
    audit,
  };
}

describe('CreateMatchRulesetUseCase', () => {
  it('publishes the next version and archives the previous active one', async () => {
    const { useCase, archiveActive, insert } = build();
    const published = await useCase.execute(ACTOR, 'team-1', {
      content: content(),
    });
    expect(published.rulesetVersion).toBe(2);
    expect(archiveActive).toHaveBeenCalledWith(
      TX,
      'team-1',
      'wfdf-indoor',
      NOW,
    );
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      id: 'rules-2',
      rulesetVersion: 2,
      createdBy: 'coach-1',
      hardCap: 17,
    });
  });

  it('records an audit entry citing the published caps', async () => {
    const { useCase, audit } = build();
    await useCase.execute(ACTOR, 'team-1', { content: content() });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.ruleset.created',
      diff: { rulesetKey: 'wfdf-indoor', rulesetVersion: 2, hardCap: 17 },
    });
  });

  it('refuses a season outside the team without archiving anything', async () => {
    const { useCase, archiveActive, insert } = build({ seasonOk: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: content({ seasonId: 'season-9' }),
      }),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
    expect(archiveActive).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('carries an unconfigured cap through as null, never zero', async () => {
    const { useCase, insert } = build();
    await useCase.execute(ACTOR, 'team-1', {
      content: content({ hardCap: null }),
    });
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      hardCap: null,
      softCapMinutes: null,
      timeCapMinutes: null,
      halftimeAt: null,
    });
  });
});
