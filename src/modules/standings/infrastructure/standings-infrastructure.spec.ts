import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { describe, expect, it, vi } from 'vitest';

import {
  AchievementCategory,
  AchievementSource,
  AchievementStatus,
  AchievementVisibility,
  StandingEntrantKind,
  StandingQualification,
  StandingSource,
  StandingTieBreak,
} from '../model/standings.enums';
import type {
  AchievementRow,
  StandingRow,
  StandingsRuleRow,
} from '../model/standings.rows';
import { AchievementRepository } from './achievement.repository';
import { StandingRepository } from './standing.repository';
import { StandingsRuleRepository } from './standings-rule.repository';
import { StandingsScopeRepository } from './standings-scope.repository';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const RULE_ROW: StandingsRuleRow = {
  id: 'rule-1',
  team_id: 'team-1',
  rule_key: 'wfdf',
  version: 1,
  name: 'WFDF',
  win_points: 3,
  loss_points: 0,
  tie_points: 1,
  tie_break_order: ['standing_points'],
  effective_from: NOW,
  status: 'active',
  created_by: 'user-1',
  created_at: NOW,
};

const STANDING_ROW: StandingRow = {
  id: 'standing-1',
  team_id: 'team-1',
  season_id: 'season-1',
  competition_id: 'comp-1',
  stage_id: null,
  rule_version_id: 'rule-1',
  pool_label: null,
  entrant_kind: 'team',
  opponent_id: null,
  opponent_name: null,
  played: 1,
  wins: 1,
  losses: 0,
  ties: 0,
  points_for: 15,
  points_against: 10,
  standing_points: 3,
  spirit_score: null,
  final_place: null,
  qualification: 'undecided',
  source: 'derived',
  source_reference: null,
  reconciliation_note: null,
  record_version: 1,
  recorded_by: 'user-1',
  computed_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const ACHIEVEMENT_ROW: AchievementRow = {
  id: 'ach-1',
  team_id: 'team-1',
  season_id: null,
  competition_id: null,
  membership_id: null,
  category: 'trophy',
  title: 'Champions',
  description: null,
  achieved_on: '2024-05-18',
  evidence_reference: null,
  visibility: 'team',
  status: 'draft',
  source: 'manual',
  import_reference: null,
  rejection_reason: null,
  record_version: 1,
  created_by: 'user-1',
  approved_by: null,
  approved_at: null,
  rejected_at: null,
  archived_at: null,
  created_at: NOW,
  updated_at: NOW,
};

function scopeReturning(...results: unknown[][]): {
  scope: TransactionScope;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn();
  for (const result of results) {
    run.mockResolvedValueOnce(result);
  }
  run.mockResolvedValue([]);
  return { scope: { run }, run };
}

describe('StandingsScopeRepository', () => {
  const repository = new StandingsScopeRepository();

  it('resolves a live competition scope and hides a deleted one', async () => {
    const found = scopeReturning([
      { competition_id: 'comp-1', season_id: 'season-1' },
    ]);
    expect(
      await repository.resolveCompetitionScope(found.scope, 'team-1', 'comp-1'),
    ).toEqual({ competition_id: 'comp-1', season_id: 'season-1' });
    expect(String(found.run.mock.calls[0]?.[0])).toContain(
      'c."deleted_at" IS NULL',
    );
    const missing = scopeReturning([]);
    expect(
      await repository.resolveCompetitionScope(
        missing.scope,
        'team-1',
        'comp-9',
      ),
    ).toBeNull();
  });

  it('probes active team, stage, and opponent membership', async () => {
    const team = scopeReturning([{ id: 'team-1' }]);
    expect(await repository.activeTeamExists(team.scope, 'team-1')).toBe(true);
    const stage = scopeReturning([]);
    expect(
      await repository.stageExistsInCompetition(
        stage.scope,
        'comp-1',
        'stage-9',
      ),
    ).toBe(false);
    const opponent = scopeReturning([{ id: 'opp-1' }]);
    expect(
      await repository.opponentExistsInTeam(opponent.scope, 'team-1', 'opp-1'),
    ).toBe(true);
  });

  it('projects only finalized matches, bounded', async () => {
    const { scope, run } = scopeReturning([
      {
        match_id: 'match-1',
        competition_id: 'comp-1',
        stage_id: null,
        opponent_id: 'opp-1',
        our_score: 15,
        opponent_score: 10,
        result: 'win',
      },
    ]);
    const results = await repository.listFinalizedResults(
      scope,
      'team-1',
      'comp-1',
    );
    expect(results).toHaveLength(1);
    expect(String(run.mock.calls[0]?.[0])).toContain(`'finalized'`);
    expect(run.mock.calls[0]?.[1]).toContain(500);
  });
});

describe('StandingsRuleRepository', () => {
  const repository = new StandingsRuleRepository();
  const newRule = {
    id: 'rule-1',
    teamId: 'team-1',
    ruleKey: 'wfdf',
    version: 1,
    name: 'WFDF',
    winPoints: 3,
    lossPoints: 0,
    tiePoints: 1,
    tieBreakOrder: [StandingTieBreak.StandingPoints],
    effectiveFrom: NOW,
    createdBy: 'user-1',
  };

  it('inserts a version and returns the persisted rule', async () => {
    const { scope, run } = scopeReturning([RULE_ROW]);
    expect((await repository.insert(scope, newRule)).ruleKey).toBe('wfdf');
    expect(String(run.mock.calls[0]?.[0])).not.toContain('SELECT *');
  });

  it('throws when a rule write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newRule)).rejects.toThrow(
      /standings rule write/u,
    );
  });

  it('resolves the newest active version of a key', async () => {
    const found = scopeReturning([RULE_ROW]);
    expect(
      (await repository.findLatestByKey(found.scope, 'team-1', 'wfdf'))
        ?.version,
    ).toBe(1);
    expect(String(found.run.mock.calls[0]?.[0])).toContain(
      'ORDER BY "version" DESC',
    );
    const missing = scopeReturning([]);
    expect(
      await repository.findLatestByKey(missing.scope, 'team-1', 'none'),
    ).toBeNull();
  });

  it('resolves a version by id and hides a foreign one', async () => {
    const found = scopeReturning([RULE_ROW]);
    expect(
      (await repository.findById(found.scope, 'team-1', 'rule-1'))
        ?.ruleVersionId,
    ).toBe('rule-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findById(missing.scope, 'team-1', 'rule-9'),
    ).toBeNull();
  });

  it('bounds the version list and counts it', async () => {
    const list = scopeReturning([RULE_ROW]);
    expect(
      await repository.listForTeam(list.scope, 'team-1', {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: '2' }]);
    expect(await repository.countForTeam(count.scope, 'team-1')).toBe(2);
    const empty = scopeReturning([]);
    expect(await repository.countForTeam(empty.scope, 'team-1')).toBe(0);
  });
});

describe('StandingRepository', () => {
  const repository = new StandingRepository();
  const upsert = {
    id: 'standing-1',
    teamId: 'team-1',
    seasonId: 'season-1',
    competitionId: 'comp-1',
    stageId: null,
    ruleVersionId: 'rule-1',
    poolLabel: null,
    entrantKind: StandingEntrantKind.Team,
    opponentId: null,
    tally: {
      played: 1,
      wins: 1,
      losses: 0,
      ties: 0,
      pointsFor: 15,
      pointsAgainst: 10,
      standingPoints: 3,
    },
    spiritScore: null,
    finalPlace: null,
    qualification: StandingQualification.Undecided,
    source: StandingSource.Derived,
    sourceReference: null,
    reconciliationNote: null,
    recordedBy: 'user-1',
    now: NOW,
  };

  it('upserts idempotently on the entrant key', async () => {
    const { scope, run } = scopeReturning([STANDING_ROW]);
    const written = await repository.upsert(scope, upsert);
    expect(written.standingId).toBe('standing-1');
    expect(written.opponentName).toBeNull();
    expect(String(run.mock.calls[0]?.[0])).toContain('ON CONFLICT');
    // A team row carries no opponent, so no name probe is issued.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('resolves the opponent display name after an opponent-row upsert (B5)', async () => {
    const opponentRow = { ...STANDING_ROW, opponent_id: 'opp-1' };
    const { scope, run } = scopeReturning(
      [opponentRow],
      [{ name: 'Thunder Disc Club' }],
    );
    const written = await repository.upsert(scope, {
      ...upsert,
      entrantKind: StandingEntrantKind.Opponent,
      opponentId: 'opp-1',
    });
    expect(written.opponentName).toBe('Thunder Disc Club');
    expect(String(run.mock.calls[1]?.[0])).toContain('FROM "opponents"');
    expect(run.mock.calls[1]?.[1]).toEqual(['opp-1', 'team-1']);
  });

  it('throws when a standings write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.upsert(scope, upsert)).rejects.toThrow(
      /standings write/u,
    );
  });

  it('resolves a row by id and hides a foreign one', async () => {
    const found = scopeReturning([STANDING_ROW]);
    expect(
      (await repository.findById(found.scope, 'team-1', 'standing-1'))
        ?.standingId,
    ).toBe('standing-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findById(missing.scope, 'team-1', 'standing-9'),
    ).toBeNull();
  });

  it('bounds the table read and counts with the same filter', async () => {
    const filter = { competitionId: 'comp-1', stageId: null, source: null };
    const list = scopeReturning([STANDING_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(200);
    const listSql = String(list.run.mock.calls[0]?.[0]);
    expect(listSql).toContain('LEFT JOIN "opponents" o');
    expect(listSql).toContain('o."name" AS "opponent_name"');
    const count = scopeReturning([{ count: 4 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      4,
    );
    const empty = scopeReturning([]);
    expect(await repository.countForScope(empty.scope, 'team-1', filter)).toBe(
      0,
    );
  });
});

describe('AchievementRepository', () => {
  const repository = new AchievementRepository();
  const newAchievement = {
    id: 'ach-1',
    teamId: 'team-1',
    seasonId: null,
    competitionId: null,
    membershipId: null,
    category: AchievementCategory.Trophy,
    title: 'Champions',
    description: null,
    achievedOn: '2024-05-18',
    evidenceReference: null,
    visibility: AchievementVisibility.Team,
    source: AchievementSource.Manual,
    importReference: null,
    createdBy: 'user-1',
    now: NOW,
  };

  it('inserts a claim as a draft', async () => {
    const { scope, run } = scopeReturning([ACHIEVEMENT_ROW]);
    expect((await repository.insert(scope, newAchievement)).status).toBe(
      AchievementStatus.Draft,
    );
    expect(String(run.mock.calls[0]?.[0])).toContain(`'draft'`);
  });

  it('throws when an achievement write returns no row', async () => {
    const { scope } = scopeReturning([]);
    await expect(repository.insert(scope, newAchievement)).rejects.toThrow(
      /achievement write/u,
    );
  });

  it('resolves by id and by audited import reference', async () => {
    const byId = scopeReturning([ACHIEVEMENT_ROW]);
    expect(
      (await repository.findForWrite(byId.scope, 'team-1', 'ach-1'))
        ?.achievementId,
    ).toBe('ach-1');
    const missing = scopeReturning([]);
    expect(
      await repository.findForWrite(missing.scope, 'team-1', 'ach-9'),
    ).toBeNull();
    const byRef = scopeReturning([ACHIEVEMENT_ROW]);
    expect(
      (await repository.findByImportReference(byRef.scope, 'team-1', 'r-1'))
        ?.achievementId,
    ).toBe('ach-1');
    const noRef = scopeReturning([]);
    expect(
      await repository.findByImportReference(noRef.scope, 'team-1', 'r-9'),
    ).toBeNull();
  });

  it('guards an approval change with the expected record version', async () => {
    const change = {
      id: 'ach-1',
      teamId: 'team-1',
      expectedRecordVersion: 1,
      toStatus: AchievementStatus.Approved,
      approvedBy: 'user-2',
      approvedAt: NOW,
      rejectedAt: null,
      rejectionReason: null,
      archivedAt: null,
      now: NOW,
    };
    const applied = scopeReturning([
      { ...ACHIEVEMENT_ROW, status: 'approved' },
    ]);
    expect(
      (await repository.applyStatusChange(applied.scope, change))?.status,
    ).toBe(AchievementStatus.Approved);
    expect(String(applied.run.mock.calls[0]?.[0])).toContain(
      '"rejection_reason" = $8',
    );
    const stale = scopeReturning([]);
    expect(await repository.applyStatusChange(stale.scope, change)).toBeNull();
  });

  it('writes and returns the rejection reason on a reject change (B4)', async () => {
    const rejected = scopeReturning([
      {
        ...ACHIEVEMENT_ROW,
        status: 'rejected',
        rejection_reason: 'No evidence provided',
      },
    ]);
    const changed = await repository.applyStatusChange(rejected.scope, {
      id: 'ach-1',
      teamId: 'team-1',
      expectedRecordVersion: 1,
      toStatus: AchievementStatus.Rejected,
      approvedBy: null,
      approvedAt: null,
      rejectedAt: NOW,
      rejectionReason: 'No evidence provided',
      archivedAt: null,
      now: NOW,
    });
    expect(changed?.rejectionReason).toBe('No evidence provided');
    expect(rejected.run.mock.calls[0]?.[1]).toContain('No evidence provided');
  });

  it('bounds the achievement list and counts with the same predicate', async () => {
    const filter = {
      seasonId: null,
      competitionId: null,
      category: null,
      status: AchievementStatus.Approved,
      membershipId: null,
    };
    const list = scopeReturning([ACHIEVEMENT_ROW]);
    expect(
      await repository.listForScope(list.scope, 'team-1', filter, {
        limit: 900,
        offset: 0,
      }),
    ).toHaveLength(1);
    expect(list.run.mock.calls[0]?.[1]).toContain(100);
    const count = scopeReturning([{ count: 7 }]);
    expect(await repository.countForScope(count.scope, 'team-1', filter)).toBe(
      7,
    );
    const empty = scopeReturning([]);
    expect(await repository.countForScope(empty.scope, 'team-1', filter)).toBe(
      0,
    );
  });
});
