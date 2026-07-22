import type { AuthUserIdentity } from '@core/auth';
import type { ClockPort } from '@core/clock/clock.port';
import type { IdGeneratorPort } from '@core/id-generator/id-generator.port';
import type {
  TransactionScope,
  UnitOfWorkPort,
} from '@core/persistence/unit-of-work.port';
import type {
  AuditRecorderService,
  RecordDomainEventService,
} from '@modules/platform';
import { describe, expect, it, vi } from 'vitest';

import { AchievementInvalidTransitionError } from '../errors/achievement-invalid-transition.error';
import { AchievementNotFoundError } from '../errors/achievement-not-found.error';
import { StandingsRuleNotFoundError } from '../errors/standings-rule-not-found.error';
import { StandingsScopeNotFoundError } from '../errors/standings-scope-not-found.error';
import { StandingsValidationError } from '../errors/standings-validation.error';
import { StandingsVersionConflictError } from '../errors/standings-version-conflict.error';
import type { AchievementRepository } from '../infrastructure/achievement.repository';
import type { StandingRepository } from '../infrastructure/standing.repository';
import type { StandingsRuleRepository } from '../infrastructure/standings-rule.repository';
import type { StandingsScopeRepository } from '../infrastructure/standings-scope.repository';
import {
  AchievementCategory,
  AchievementImportOutcome,
  AchievementSource,
  AchievementStatus,
  AchievementTransition,
  AchievementVisibility,
  MatchOutcome,
  StandingEntrantKind,
  StandingQualification,
  StandingRuleStatus,
  StandingSource,
  StandingTieBreak,
} from '../model/standings.enums';
import type {
  Achievement,
  CompetitionStanding,
  ManualStandingContent,
  StandingsRuleVersion,
} from '../model/standings.types';
import { AchievementQueryService } from './achievement-query.service';
import { CreateAchievementUseCase } from './create-achievement.use-case';
import { CreateStandingsRuleUseCase } from './create-standings-rule.use-case';
import { ImportAchievementsUseCase } from './import-achievements.use-case';
import { RecomputeStandingsUseCase } from './recompute-standings.use-case';
import { RecordManualStandingUseCase } from './record-manual-standing.use-case';
import { StandingsQueryService } from './standings-query.service';
import { StandingsRuleService } from './standings-rule.service';
import { StandingsScopeService } from './standings-scope.service';
import { TransitionAchievementUseCase } from './transition-achievement.use-case';

const NOW = new Date('2025-03-01T00:00:00.000Z');
const TX = { run: vi.fn() } as unknown as TransactionScope;
const UOW: UnitOfWorkPort = { runInTransaction: operation => operation(TX) };
const CLOCK: ClockPort = { now: () => NOW, uptime: () => 0 };
let counter = 0;
const IDS: IdGeneratorPort = {
  generate: () => {
    counter += 1;
    return `generated-${counter}`;
  },
};
const ACTOR: AuthUserIdentity = {
  userId: 'user-1',
  email: 'admin@example.test',
  roles: [],
};

const RULE: StandingsRuleVersion = {
  ruleVersionId: 'rule-1',
  teamId: 'team-1',
  ruleKey: 'wfdf',
  version: 1,
  name: 'WFDF',
  winPoints: 3,
  lossPoints: 0,
  tiePoints: 1,
  tieBreakOrder: [StandingTieBreak.StandingPoints, StandingTieBreak.Wins],
  effectiveFrom: NOW,
  status: StandingRuleStatus.Active,
  createdBy: 'user-1',
  createdAt: NOW,
};

const STANDING: CompetitionStanding = {
  standingId: 'standing-1',
  teamId: 'team-1',
  seasonId: 'season-1',
  competitionId: 'comp-1',
  stageId: null,
  ruleVersionId: 'rule-1',
  poolLabel: null,
  entrantKind: StandingEntrantKind.Team,
  opponentId: null,
  played: 1,
  wins: 1,
  losses: 0,
  ties: 0,
  pointsFor: 15,
  pointsAgainst: 10,
  standingPoints: 3,
  spiritScore: null,
  finalPlace: null,
  qualification: StandingQualification.Undecided,
  source: StandingSource.Derived,
  sourceReference: null,
  reconciliationNote: null,
  recordVersion: 1,
  recordedBy: 'user-1',
  computedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const ACHIEVEMENT: Achievement = {
  achievementId: 'ach-1',
  teamId: 'team-1',
  seasonId: null,
  competitionId: null,
  membershipId: null,
  category: AchievementCategory.Trophy,
  title: 'Champions',
  description: 'private note',
  achievedOn: '2024-05-18',
  evidenceReference: null,
  visibility: AchievementVisibility.Team,
  status: AchievementStatus.Draft,
  source: AchievementSource.Manual,
  importReference: null,
  recordVersion: 1,
  createdBy: 'user-1',
  approvedBy: null,
  approvedAt: null,
  rejectedAt: null,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const MANUAL: ManualStandingContent = {
  competitionId: 'comp-1',
  stageId: null,
  poolLabel: null,
  entrantKind: StandingEntrantKind.Team,
  opponentId: null,
  played: 2,
  wins: 1,
  losses: 1,
  ties: 0,
  pointsFor: 25,
  pointsAgainst: 22,
  spiritScore: null,
  finalPlace: 3,
  qualification: StandingQualification.Qualified,
  sourceReference: 'organiser.pdf',
  reconciliationNote: 'organiser table differs on point diff',
  ruleKey: 'wfdf',
};

function auditStub(): AuditRecorderService {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorderService;
}

function eventsStub(): RecordDomainEventService {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as RecordDomainEventService;
}

function scopeRepo(
  overrides: Record<string, unknown> = {},
): StandingsScopeRepository {
  return {
    activeTeamExists: vi.fn().mockResolvedValue(true),
    resolveCompetitionScope: vi
      .fn()
      .mockResolvedValue({ competition_id: 'comp-1', season_id: 'season-1' }),
    stageExistsInCompetition: vi.fn().mockResolvedValue(true),
    opponentExistsInTeam: vi.fn().mockResolvedValue(true),
    listFinalizedResults: vi.fn().mockResolvedValue([
      {
        matchId: 'match-1',
        competitionId: 'comp-1',
        stageId: null,
        opponentId: 'opp-1',
        ourScore: 15,
        opponentScore: 10,
        result: MatchOutcome.Win,
      },
    ]),
    ...overrides,
  };
}

function ruleRepo(
  overrides: Record<string, unknown> = {},
): StandingsRuleRepository {
  return {
    insert: vi.fn().mockResolvedValue(RULE),
    findLatestByKey: vi.fn().mockResolvedValue(RULE),
    findById: vi.fn().mockResolvedValue(RULE),
    listForTeam: vi.fn().mockResolvedValue([RULE]),
    countForTeam: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

function standingRepo(
  overrides: Record<string, unknown> = {},
): StandingRepository {
  return {
    upsert: vi.fn().mockResolvedValue(STANDING),
    findById: vi.fn().mockResolvedValue(STANDING),
    listForScope: vi.fn().mockResolvedValue([STANDING]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as StandingRepository;
}

function achievementRepo(
  overrides: Record<string, unknown> = {},
): AchievementRepository {
  return {
    insert: vi.fn().mockResolvedValue(ACHIEVEMENT),
    findForWrite: vi.fn().mockResolvedValue(ACHIEVEMENT),
    findByImportReference: vi.fn().mockResolvedValue(null),
    applyStatusChange: vi.fn().mockResolvedValue(ACHIEVEMENT),
    listForScope: vi.fn().mockResolvedValue([ACHIEVEMENT]),
    countForScope: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as AchievementRepository;
}

const EMPTY_ACHIEVEMENT_FILTER = {
  seasonId: null,
  competitionId: null,
  category: null,
  status: null,
  membershipId: null,
};

describe('StandingsScopeService', () => {
  it('resolves a live competition scope', async () => {
    const service = new StandingsScopeService(scopeRepo());
    expect(await service.forCompetition(TX, 'team-1', 'comp-1')).toEqual({
      teamId: 'team-1',
      seasonId: 'season-1',
      competitionId: 'comp-1',
    });
  });

  it('hides an archived team and a foreign competition as not found', async () => {
    const inactive = new StandingsScopeService(
      scopeRepo({ activeTeamExists: vi.fn().mockResolvedValue(false) }),
    );
    await expect(
      inactive.forCompetition(TX, 'team-1', 'comp-1'),
    ).rejects.toBeInstanceOf(StandingsScopeNotFoundError);
    const missing = new StandingsScopeService(
      scopeRepo({ resolveCompetitionScope: vi.fn().mockResolvedValue(null) }),
    );
    await expect(
      missing.forCompetition(TX, 'team-1', 'comp-9'),
    ).rejects.toBeInstanceOf(StandingsScopeNotFoundError);
  });

  it('skips optional stage and opponent probes when absent', async () => {
    const repo = scopeRepo();
    const service = new StandingsScopeService(repo);
    await service.requireStage(TX, 'comp-1', null);
    await service.requireOpponent(TX, 'team-1', null);
    expect(repo.stageExistsInCompetition).not.toHaveBeenCalled();
    expect(repo.opponentExistsInTeam).not.toHaveBeenCalled();
    await service.requireStage(TX, 'comp-1', 'stage-1');
    await service.requireOpponent(TX, 'team-1', 'opp-1');
  });

  it('hides a foreign stage or opponent as not found', async () => {
    const badStage = new StandingsScopeService(
      scopeRepo({ stageExistsInCompetition: vi.fn().mockResolvedValue(false) }),
    );
    await expect(
      badStage.requireStage(TX, 'comp-1', 'stage-9'),
    ).rejects.toBeInstanceOf(StandingsScopeNotFoundError);
    const badOpponent = new StandingsScopeService(
      scopeRepo({ opponentExistsInTeam: vi.fn().mockResolvedValue(false) }),
    );
    await expect(
      badOpponent.requireOpponent(TX, 'team-1', 'opp-9'),
    ).rejects.toBeInstanceOf(StandingsScopeNotFoundError);
  });

  it('projects finalized results', async () => {
    const service = new StandingsScopeService(scopeRepo());
    expect(
      await service.listFinalizedResults(TX, 'team-1', 'comp-1'),
    ).toHaveLength(1);
  });
});

describe('StandingsRuleService', () => {
  it('resolves the newest active version of a key', async () => {
    const service = new StandingsRuleService(UOW, ruleRepo());
    expect((await service.require(TX, 'team-1', 'wfdf')).ruleKey).toBe('wfdf');
  });

  it('refuses to fall back to an unpublished default rule', async () => {
    const service = new StandingsRuleService(
      UOW,
      ruleRepo({ findLatestByKey: vi.fn().mockResolvedValue(null) }),
    );
    await expect(service.require(TX, 'team-1', 'none')).rejects.toBeInstanceOf(
      StandingsRuleNotFoundError,
    );
    expect(await service.nextVersion(TX, 'team-1', 'none')).toBe(1);
  });

  it('increments the version of an existing key', async () => {
    const service = new StandingsRuleService(UOW, ruleRepo());
    expect(await service.nextVersion(TX, 'team-1', 'wfdf')).toBe(2);
  });

  it('returns a bounded page of versions', async () => {
    const service = new StandingsRuleService(UOW, ruleRepo());
    expect(
      await service.listForTeam('team-1', { limit: 20, offset: 0 }),
    ).toEqual({ items: [RULE], total: 1, limit: 20, offset: 0 });
  });
});

describe('StandingsQueryService', () => {
  it('orders the page by the rule version the rows cite', async () => {
    const service = new StandingsQueryService(UOW, standingRepo(), ruleRepo());
    const page = await service.listForScope(
      'team-1',
      { competitionId: 'comp-1', stageId: null, source: null },
      { limit: 100, offset: 0 },
    );
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it('returns an empty page untouched', async () => {
    const service = new StandingsQueryService(
      UOW,
      standingRepo({
        listForScope: vi.fn().mockResolvedValue([]),
        countForScope: vi.fn().mockResolvedValue(0),
      }),
      ruleRepo(),
    );
    expect(
      (
        await service.listForScope(
          'team-1',
          { competitionId: null, stageId: null, source: null },
          { limit: 100, offset: 0 },
        )
      ).items,
    ).toEqual([]);
  });

  it('falls back to the stored order when the rule version is gone', async () => {
    const service = new StandingsQueryService(
      UOW,
      standingRepo(),
      ruleRepo({ findById: vi.fn().mockResolvedValue(null) }),
    );
    expect(
      (
        await service.listForScope(
          'team-1',
          { competitionId: null, stageId: null, source: null },
          { limit: 100, offset: 0 },
        )
      ).items,
    ).toEqual([STANDING]);
  });
});

describe('AchievementQueryService', () => {
  it('returns a bounded page and resolves one achievement', async () => {
    const service = new AchievementQueryService(UOW, achievementRepo());
    expect(
      await service.listForScope('team-1', EMPTY_ACHIEVEMENT_FILTER, {
        limit: 20,
        offset: 0,
      }),
    ).toEqual({ items: [ACHIEVEMENT], total: 1, limit: 20, offset: 0 });
    expect((await service.getById('team-1', 'ach-1')).achievementId).toBe(
      'ach-1',
    );
  });

  it('hides a foreign achievement as not found', async () => {
    const service = new AchievementQueryService(
      UOW,
      achievementRepo({ findForWrite: vi.fn().mockResolvedValue(null) }),
    );
    await expect(service.getById('team-1', 'ach-9')).rejects.toBeInstanceOf(
      AchievementNotFoundError,
    );
  });

  it('reads the cabinet from approved rows only and redacts them', async () => {
    const repo = achievementRepo({
      listForScope: vi
        .fn()
        .mockResolvedValue([
          { ...ACHIEVEMENT, status: AchievementStatus.Approved },
        ]),
    });
    const page = await new AchievementQueryService(UOW, repo).history(
      'team-1',
      EMPTY_ACHIEVEMENT_FILTER,
      { limit: 20, offset: 0 },
    );
    expect(page.items[0]).not.toHaveProperty('description');
    expect(repo.listForScope).toHaveBeenCalledWith(
      TX,
      'team-1',
      expect.objectContaining({ status: AchievementStatus.Approved }),
      expect.anything(),
    );
  });

  it('keeps staff-only achievements out of the cabinet', async () => {
    const repo = achievementRepo({
      listForScope: vi.fn().mockResolvedValue([
        {
          ...ACHIEVEMENT,
          status: AchievementStatus.Approved,
          visibility: AchievementVisibility.Staff,
        },
      ]),
    });
    const page = await new AchievementQueryService(UOW, repo).history(
      'team-1',
      EMPTY_ACHIEVEMENT_FILTER,
      { limit: 20, offset: 0 },
    );
    expect(page.items).toEqual([]);
  });
});

describe('CreateStandingsRuleUseCase', () => {
  it('publishes the next version rather than editing the old one', async () => {
    const rules = ruleRepo();
    const audit = auditStub();
    const useCase = new CreateStandingsRuleUseCase(
      UOW,
      CLOCK,
      IDS,
      rules,
      new StandingsRuleService(UOW, rules),
      audit,
    );
    await useCase.execute(ACTOR, 'team-1', {
      content: {
        ruleKey: 'wfdf',
        name: 'WFDF',
        winPoints: 3,
        lossPoints: 0,
        tiePoints: 1,
        tieBreakOrder: [StandingTieBreak.StandingPoints],
      },
    });
    expect(rules.insert).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ version: 2 }),
    );
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});

describe('RecomputeStandingsUseCase', () => {
  function build(scope = scopeRepo()) {
    const standings = standingRepo();
    const rules = ruleRepo();
    const events = eventsStub();
    return {
      standings,
      events,
      useCase: new RecomputeStandingsUseCase(
        UOW,
        CLOCK,
        IDS,
        new StandingsScopeService(scope),
        new StandingsRuleService(UOW, rules),
        standings,
        auditStub(),
        events,
      ),
    };
  }

  it('writes our row and one mirrored row per opponent', async () => {
    const { useCase, standings, events } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      competitionId: 'comp-1',
      ruleKey: 'wfdf',
    });
    expect(report.finalizedMatches).toBe(1);
    expect(report.entrants).toBe(2);
    expect(standings.upsert).toHaveBeenCalledTimes(2);
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('produces a single row when no finalized match exists yet', async () => {
    const { useCase, standings } = build(
      scopeRepo({ listFinalizedResults: vi.fn().mockResolvedValue([]) }),
    );
    const report = await useCase.execute(ACTOR, 'team-1', {
      competitionId: 'comp-1',
      ruleKey: 'wfdf',
    });
    expect(report.finalizedMatches).toBe(0);
    expect(standings.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('RecordManualStandingUseCase', () => {
  function build() {
    const standings = standingRepo();
    return {
      standings,
      useCase: new RecordManualStandingUseCase(
        UOW,
        CLOCK,
        IDS,
        new StandingsScopeService(scopeRepo()),
        new StandingsRuleService(UOW, ruleRepo()),
        standings,
        auditStub(),
      ),
    };
  }

  it('records an external row under a named rule version', async () => {
    const { useCase, standings } = build();
    await useCase.execute(ACTOR, 'team-1', { content: MANUAL });
    expect(standings.upsert).toHaveBeenCalledWith(
      TX,
      expect.objectContaining({ source: StandingSource.Manual }),
    );
  });

  it('rejects counts that contradict the played total', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: { ...MANUAL, played: 5 },
      }),
    ).rejects.toBeInstanceOf(StandingsValidationError);
  });

  it('rejects an entrant kind that contradicts the opponent identity', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: { ...MANUAL, opponentId: 'opp-1' },
      }),
    ).rejects.toBeInstanceOf(StandingsValidationError);
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: {
          ...MANUAL,
          entrantKind: StandingEntrantKind.Opponent,
          opponentId: null,
        },
      }),
    ).rejects.toBeInstanceOf(StandingsValidationError);
  });

  it('refuses a row without a reconciliation note', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: { ...MANUAL, reconciliationNote: '' },
      }),
    ).rejects.toThrow();
  });
});

describe('CreateAchievementUseCase', () => {
  function build() {
    const achievements = achievementRepo();
    return {
      achievements,
      useCase: new CreateAchievementUseCase(
        UOW,
        CLOCK,
        IDS,
        achievements,
        auditStub(),
      ),
    };
  }

  it('creates a draft claim that is not yet history', async () => {
    const { useCase, achievements } = build();
    const created = await useCase.execute(ACTOR, 'team-1', {
      content: {
        seasonId: null,
        competitionId: null,
        membershipId: null,
        category: AchievementCategory.Trophy,
        title: 'Champions',
        description: null,
        achievedOn: '2024-05-18',
        evidenceReference: null,
        visibility: AchievementVisibility.Team,
      },
    });
    expect(created.status).toBe(AchievementStatus.Draft);
    expect(achievements.insert).toHaveBeenCalledTimes(1);
  });

  it('refuses a date that is not a real calendar day', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute(ACTOR, 'team-1', {
        content: {
          seasonId: null,
          competitionId: null,
          membershipId: null,
          category: AchievementCategory.Trophy,
          title: 'Champions',
          description: null,
          achievedOn: '44197',
          evidenceReference: null,
          visibility: AchievementVisibility.Team,
        },
      }),
    ).rejects.toBeInstanceOf(StandingsValidationError);
  });
});

describe('TransitionAchievementUseCase', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const achievements = achievementRepo(overrides);
    const events = eventsStub();
    return {
      events,
      useCase: new TransitionAchievementUseCase(
        UOW,
        CLOCK,
        new AchievementQueryService(UOW, achievements),
        achievements,
        auditStub(),
        events,
      ),
    };
  }

  it('submits a draft without publishing an approval event', async () => {
    const { useCase, events } = build({
      applyStatusChange: vi.fn().mockResolvedValue({
        ...ACHIEVEMENT,
        status: AchievementStatus.Submitted,
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'ach-1', {
      transition: AchievementTransition.Submit,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue).not.toHaveBeenCalled();
  });

  it('publishes an approval event when a claim becomes history', async () => {
    const { useCase, events } = build({
      findForWrite: vi.fn().mockResolvedValue({
        ...ACHIEVEMENT,
        status: AchievementStatus.Submitted,
      }),
      applyStatusChange: vi.fn().mockResolvedValue({
        ...ACHIEVEMENT,
        status: AchievementStatus.Approved,
      }),
    });
    await useCase.execute(ACTOR, 'team-1', 'ach-1', {
      transition: AchievementTransition.Approve,
      expectedRecordVersion: 1,
    });
    expect(events.enqueue).toHaveBeenCalledTimes(1);
  });

  it('refuses to approve a claim that was never submitted', async () => {
    const { useCase } = build();
    await expect(
      useCase.execute(ACTOR, 'team-1', 'ach-1', {
        transition: AchievementTransition.Approve,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(AchievementInvalidTransitionError);
  });

  it('reports a lost race as a version conflict', async () => {
    const { useCase } = build({
      applyStatusChange: vi.fn().mockResolvedValue(null),
    });
    await expect(
      useCase.execute(ACTOR, 'team-1', 'ach-1', {
        transition: AchievementTransition.Submit,
        expectedRecordVersion: 1,
      }),
    ).rejects.toBeInstanceOf(StandingsVersionConflictError);
  });
});

describe('ImportAchievementsUseCase', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const achievements = achievementRepo(overrides);
    return {
      achievements,
      useCase: new ImportAchievementsUseCase(
        UOW,
        CLOCK,
        IDS,
        achievements,
        auditStub(),
      ),
    };
  }

  const row = {
    reference: 'r-1',
    category: AchievementCategory.Trophy,
    title: 'Champions',
    description: null,
    achievedOn: '2019-05-01',
    seasonId: null,
    competitionId: null,
    evidenceReference: null,
    visibility: AchievementVisibility.Team,
  };

  it('writes nothing on a dry run but reports the outcome', async () => {
    const { useCase, achievements } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: true,
      rows: [row],
    });
    expect(report.imported).toBe(1);
    expect(achievements.insert).not.toHaveBeenCalled();
  });

  it('imports a row as a draft awaiting approval', async () => {
    const { useCase, achievements } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [row],
    });
    expect(report.imported).toBe(1);
    expect(achievements.insert).toHaveBeenCalledTimes(1);
  });

  it('reports a replayed reference as a duplicate', async () => {
    const { useCase, achievements } = build({
      findByImportReference: vi.fn().mockResolvedValue(ACHIEVEMENT),
    });
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [row],
    });
    expect(report.skippedDuplicate).toBe(1);
    expect(achievements.insert).not.toHaveBeenCalled();
  });

  it('rejects a broken formula cell instead of storing it as a trophy', async () => {
    const { useCase } = build();
    const report = await useCase.execute(ACTOR, 'team-1', {
      dryRun: false,
      rows: [{ ...row, title: '#REF!' }],
    });
    expect(report.rejectedInvalid).toBe(1);
    expect(report.rows[0]?.outcome).toBe(
      AchievementImportOutcome.RejectedInvalid,
    );
  });
});
