import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type { AuditRecorderService } from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { MatchRulesetNotFoundError } from '../errors/match-ruleset-not-found.error';
import { MatchScopeNotFoundError } from '../errors/match-scope-not-found.error';
import type { MatchRepository } from '../infrastructure/match.repository';
import type { MatchRulesetRepository } from '../infrastructure/match-ruleset.repository';
import {
  CapKind,
  MatchResult,
  MatchStatus,
  RulesetStatus,
} from '../model/matches.enums';
import type { Match, MatchRuleset } from '../model/matches.types';
import { CreateMatchUseCase } from './create-match.use-case';
import type { MatchScopeService } from './match-scope.service';

const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const NOW = new Date('2026-03-01T10:00:00.000Z');
const CLOCK = { now: () => NOW } as unknown as ClockPort;
const ID_GEN = { generate: () => 'match-1' };
const ACTOR: AuthUserIdentity = {
  userId: 'coach-1',
  email: 'coach@example.test',
  roles: [],
};
const SCOPE = {
  competitionId: 'comp-1',
  seasonId: 'season-1',
  homeAway: 'away',
};

function ruleset(status = RulesetStatus.Active): MatchRuleset {
  return {
    rulesetId: 'rules-1',
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
    status,
    notes: null,
    createdBy: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function match(): Match {
  return {
    matchId: 'match-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    fixtureId: 'fixture-1',
    rosterId: null,
    rulesetId: 'rules-1',
    status: MatchStatus.Scheduled,
    homeAway: 'away',
    ourScore: 0,
    opponentScore: 0,
    period: 1,
    streamVersion: 0,
    recordVersion: 1,
    revision: 1,
    result: MatchResult.Undecided,
    capApplied: CapKind.None,
    engineVersion: 'match-scoring-v1',
    supersedesMatchId: null,
    reopenReason: null,
    reopenedBy: null,
    reopenedAt: null,
    createdBy: 'coach-1',
    startedAt: null,
    pausedAt: null,
    resumedAt: null,
    halftimeAt: null,
    completedAt: null,
    finalizedBy: null,
    finalizedAt: null,
    abandonedAt: null,
    abandonReason: null,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function build(options: {
  scopeOk?: boolean;
  byId?: MatchRuleset | null;
  byDefault?: MatchRuleset | null;
}): {
  useCase: CreateMatchUseCase;
  insert: ReturnType<typeof vi.fn>;
  audit: { record: ReturnType<typeof vi.fn> };
  findDefaultActive: ReturnType<typeof vi.fn>;
} {
  const insert = vi.fn().mockResolvedValue(match());
  const findDefaultActive = vi
    .fn()
    .mockResolvedValue('byDefault' in options ? options.byDefault : ruleset());
  const rulesets = {
    findById: vi
      .fn()
      .mockResolvedValue('byId' in options ? options.byId : ruleset()),
    findDefaultActive,
  } as unknown as MatchRulesetRepository;
  const scope = {
    forFixture: vi.fn().mockImplementation(() => {
      if (options.scopeOk === false) {
        throw new MatchScopeNotFoundError();
      }
      return Promise.resolve(SCOPE);
    }),
  } as unknown as MatchScopeService;
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    useCase: new CreateMatchUseCase(
      UOW,
      CLOCK,
      ID_GEN,
      scope,
      rulesets,
      { insert } as unknown as MatchRepository,
      audit as unknown as AuditRecorderService,
    ),
    insert,
    audit,
    findDefaultActive,
  };
}

describe('CreateMatchUseCase', () => {
  it('creates a scheduled match pinned to the named active ruleset', async () => {
    const { useCase, insert } = build({});
    const created = await useCase.execute(ACTOR, 'team-1', {
      content: {
        fixtureId: 'fixture-1',
        rosterId: 'roster-1',
        rulesetId: 'rules-1',
        notes: null,
      },
    });
    expect(created.status).toBe(MatchStatus.Scheduled);
    expect(insert.mock.calls[0]?.[1]).toMatchObject({
      id: 'match-1',
      seasonId: 'season-1',
      competitionId: 'comp-1',
      homeAway: 'away',
      rulesetId: 'rules-1',
      revision: 1,
      createdBy: 'coach-1',
    });
  });

  it('adopts the team default active ruleset when none is named', async () => {
    const { useCase, findDefaultActive } = build({});
    await useCase.execute(ACTOR, 'team-1', {
      content: {
        fixtureId: 'fixture-1',
        rosterId: null,
        rulesetId: null,
        notes: null,
      },
    });
    expect(findDefaultActive).toHaveBeenCalledWith(TX, 'team-1');
  });

  it('refuses a match when the team has no active ruleset at all', async () => {
    const { useCase, insert } = build({ byDefault: null });
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: {
          fixtureId: 'fixture-1',
          rosterId: null,
          rulesetId: null,
          notes: null,
        },
      }),
    ).rejects.toBeInstanceOf(MatchRulesetNotFoundError);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses an archived ruleset version', async () => {
    const { useCase, insert } = build({
      byId: ruleset(RulesetStatus.Archived),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: {
          fixtureId: 'fixture-1',
          rosterId: null,
          rulesetId: 'rules-1',
          notes: null,
        },
      }),
    ).rejects.toBeInstanceOf(MatchRulesetNotFoundError);
    expect(insert).not.toHaveBeenCalled();
  });

  it('hides another team’s fixture behind a not-found scope', async () => {
    const { useCase, insert } = build({ scopeOk: false });
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: {
          fixtureId: 'fixture-9',
          rosterId: null,
          rulesetId: null,
          notes: null,
        },
      }),
    ).rejects.toBeInstanceOf(MatchScopeNotFoundError);
    expect(insert).not.toHaveBeenCalled();
  });

  it('records the creation in the audit log', async () => {
    const { useCase, audit } = build({});
    await useCase.execute(ACTOR, 'team-1', {
      content: {
        fixtureId: 'fixture-1',
        rosterId: null,
        rulesetId: 'rules-1',
        notes: null,
      },
    });
    expect(audit.record.mock.calls[0]?.[1]).toMatchObject({
      action: 'match.created',
      resourceId: 'match-1',
    });
  });
});
