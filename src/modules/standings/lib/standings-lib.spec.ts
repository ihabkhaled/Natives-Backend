import { describe, expect, it } from 'vitest';

import {
  AchievementCategory,
  AchievementImportOutcome,
  AchievementStatus,
  AchievementVisibility,
  MatchOutcome,
  StandingEntrantKind,
  StandingQualification,
  StandingRuleStatus,
  StandingSource,
  StandingTieBreak,
} from '../model/standings.enums';
import type {
  AchievementRow,
  StandingRow,
  StandingsRuleRow,
} from '../model/standings.rows';
import type {
  Achievement,
  CompetitionStanding,
  StandingsRuleVersion,
  StandingsScope,
  StandingTally,
} from '../model/standings.types';
import {
  buildAchievementImportReport,
  buildAchievementRowResult,
  countOutcome,
  hasCleanText,
  isBalancedAchievementReport,
  isCalendarDay,
  isImportableRow,
} from './achievement-import.reconciler';
import {
  buildAchievementApprovedEvent,
  buildAchievementAudit,
  buildAchievementImportAudit,
  buildAchievementStatusChange,
  buildDerivedStanding,
  buildImportedAchievement,
  buildManualStanding,
  buildNewAchievement,
  buildNewRuleVersion,
  buildRecomputeAudit,
  buildRuleAudit,
  buildStandingAudit,
  buildStandingsRecomputedEvent,
} from './standings.builders';
import {
  parseEnumValue,
  parseEnumValues,
  resolveStandingsPage,
  resolveTablePage,
  toCalendarDay,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './standings.helpers';
import {
  toAchievement,
  toFinalizedMatch,
  toHistoryEntry,
  toStanding,
  toStandingsRule,
} from './standings.mapper';
import {
  toAchievementContent,
  toAchievementImportRow,
  toAchievementImportRows,
  toAchievementListFilter,
  toManualStandingContent,
  toStandingListFilter,
  toStandingsRuleContent,
} from './standings-command.mapper';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const RULE_ROW: StandingsRuleRow = {
  id: 'rule-1',
  team_id: 'team-1',
  rule_key: 'wfdf',
  version: '2',
  name: 'WFDF',
  win_points: '3',
  loss_points: '0',
  tie_points: '1',
  tie_break_order: ['standing_points', 'wins'],
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
  played: '3',
  wins: '2',
  losses: '1',
  ties: '0',
  points_for: '40',
  points_against: '30',
  standing_points: '6',
  spirit_score: null,
  final_place: null,
  qualification: 'undecided',
  source: 'derived',
  source_reference: null,
  reconciliation_note: null,
  record_version: '1',
  recorded_by: 'user-1',
  computed_at: NOW,
  created_at: NOW,
  updated_at: NOW,
};

const ACHIEVEMENT_ROW: AchievementRow = {
  id: 'ach-1',
  team_id: 'team-1',
  season_id: 'season-1',
  competition_id: 'comp-1',
  membership_id: null,
  category: 'trophy',
  title: 'Cairo Open champions',
  description: 'Won the final',
  achieved_on: '2024-05-18',
  evidence_reference: 'drive://evidence',
  visibility: 'public',
  status: 'approved',
  source: 'manual',
  import_reference: null,
  record_version: '1',
  created_by: 'user-1',
  approved_by: 'user-2',
  approved_at: NOW,
  rejected_at: null,
  archived_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const RULE: StandingsRuleVersion = toStandingsRule(RULE_ROW);
const STANDING: CompetitionStanding = toStanding(STANDING_ROW);
const ACHIEVEMENT: Achievement = toAchievement(ACHIEVEMENT_ROW);
const SCOPE: StandingsScope = {
  teamId: 'team-1',
  seasonId: 'season-1',
  competitionId: 'comp-1',
};
const TALLY: StandingTally = {
  played: 3,
  wins: 2,
  losses: 1,
  ties: 0,
  pointsFor: 40,
  pointsAgainst: 30,
  standingPoints: 6,
};

describe('standings helpers', () => {
  it('clamps both paging windows', () => {
    expect(resolveStandingsPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(resolveStandingsPage(999, 5)).toEqual({ limit: 100, offset: 5 });
    expect(resolveTablePage(undefined, undefined)).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(resolveTablePage(999, 0)).toEqual({ limit: 200, offset: 0 });
  });

  it('coerces driver values without inventing zeros', () => {
    expect(toDate(NOW)).toBe(NOW);
    expect(toDate('2025-01-01T00:00:00.000Z')).toBeInstanceOf(Date);
    expect(toNullableDate(null)).toBeNull();
    expect(toNumber('4')).toBe(4);
    expect(toNumber(4)).toBe(4);
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber('9')).toBe(9);
  });

  it('renders a calendar day without a timezone shift', () => {
    expect(toCalendarDay('2024-05-18')).toBe('2024-05-18');
    expect(toCalendarDay(new Date('2024-05-18T00:00:00.000Z'))).toBe(
      '2024-05-18',
    );
  });

  it('rejects an unrecognized stored enum value', () => {
    expect(parseEnumValue(['a'], 'a', 'letter')).toBe('a');
    expect(() => parseEnumValue(['a'], 'z', 'letter')).toThrow(/letter/u);
    expect(parseEnumValues(['a', 'b'], ['b', 'a'], 'letter')).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('standings mapper', () => {
  it('maps a rule version with its tie-break ordering', () => {
    expect(RULE.version).toBe(2);
    expect(RULE.tieBreakOrder).toEqual([
      StandingTieBreak.StandingPoints,
      StandingTieBreak.Wins,
    ]);
    expect(RULE.status).toBe(StandingRuleStatus.Active);
  });

  it('maps a standings row, keeping an unscored spirit as null', () => {
    expect(STANDING.spiritScore).toBeNull();
    expect(STANDING.finalPlace).toBeNull();
    expect(STANDING.entrantKind).toBe(StandingEntrantKind.Team);
    expect(STANDING.source).toBe(StandingSource.Derived);
    expect(STANDING.qualification).toBe(StandingQualification.Undecided);
  });

  it('maps an achievement and its calendar day', () => {
    expect(ACHIEVEMENT.achievedOn).toBe('2024-05-18');
    expect(ACHIEVEMENT.status).toBe(AchievementStatus.Approved);
    expect(ACHIEVEMENT.category).toBe(AchievementCategory.Trophy);
  });

  it('maps a finalized match to standings facts only', () => {
    expect(
      toFinalizedMatch({
        match_id: 'match-1',
        competition_id: 'comp-1',
        stage_id: null,
        opponent_id: 'opp-1',
        our_score: '15',
        opponent_score: '10',
        result: 'win',
      }),
    ).toEqual({
      matchId: 'match-1',
      competitionId: 'comp-1',
      stageId: null,
      opponentId: 'opp-1',
      ourScore: 15,
      opponentScore: 10,
      result: MatchOutcome.Win,
    });
  });

  it('reduces an approved achievement to a privacy-safe cabinet entry', () => {
    const entry = toHistoryEntry(ACHIEVEMENT);
    expect(entry).not.toHaveProperty('description');
    expect(entry).not.toHaveProperty('evidenceReference');
    expect(entry.title).toBe('Cairo Open champions');
  });
});

describe('standings command mapper', () => {
  it('copies the default tie-break order into a new version', () => {
    const content = toStandingsRuleContent({ ruleKey: ' wfdf ', name: ' W ' });
    expect(content.ruleKey).toBe('wfdf');
    expect(content.winPoints).toBe(3);
    expect(content.tieBreakOrder).toContain(StandingTieBreak.StandingPoints);
    expect(
      toStandingsRuleContent({
        ruleKey: 'k',
        name: 'n',
        tieBreakOrder: [StandingTieBreak.Spirit],
      }).tieBreakOrder,
    ).toEqual([StandingTieBreak.Spirit]);
  });

  it('keeps an unscored spirit and an unplaced entrant null', () => {
    const content = toManualStandingContent({
      competitionId: 'comp-1',
      entrantKind: StandingEntrantKind.Team,
      played: 1,
      wins: 1,
      losses: 0,
      ties: 0,
      pointsFor: 15,
      pointsAgainst: 10,
      reconciliationNote: ' organiser sheet ',
      ruleKey: 'wfdf',
    });
    expect(content.spiritScore).toBeNull();
    expect(content.finalPlace).toBeNull();
    expect(content.reconciliationNote).toBe('organiser sheet');
    expect(content.qualification).toBe(StandingQualification.Undecided);
  });

  it('defaults achievement visibility to team', () => {
    expect(
      toAchievementContent({
        category: AchievementCategory.Award,
        title: ' MVP ',
        achievedOn: '2024-05-18',
      }).visibility,
    ).toBe(AchievementVisibility.Team);
  });

  it('keeps every absent list facet null', () => {
    expect(toStandingListFilter({})).toEqual({
      competitionId: null,
      stageId: null,
      source: null,
    });
    expect(toAchievementListFilter({})).toEqual({
      seasonId: null,
      competitionId: null,
      category: null,
      status: null,
      membershipId: null,
    });
  });

  it('normalizes import rows', () => {
    const row = toAchievementImportRow({
      reference: ' r-1 ',
      category: AchievementCategory.Trophy,
      title: ' Champions ',
      achievedOn: '2020-01-01',
    });
    expect(row.reference).toBe('r-1');
    expect(row.visibility).toBe(AchievementVisibility.Team);
    expect(toAchievementImportRows([])).toEqual([]);
  });
});

describe('standings builders', () => {
  it('builds the next rule version at the requested number', () => {
    const rule = buildNewRuleVersion(
      'id-1',
      'team-1',
      toStandingsRuleContent({ ruleKey: 'wfdf', name: 'WFDF' }),
      3,
      'user-1',
      NOW,
    );
    expect(rule.version).toBe(3);
    expect(rule.effectiveFrom).toBe(NOW);
  });

  it('builds a derived row with no manual provenance', () => {
    const derived = buildDerivedStanding(
      'id-1',
      SCOPE,
      RULE,
      null,
      StandingEntrantKind.Team,
      null,
      TALLY,
      'user-1',
      NOW,
    );
    expect(derived.source).toBe(StandingSource.Derived);
    expect(derived.reconciliationNote).toBeNull();
    expect(derived.spiritScore).toBeNull();
  });

  it('builds a manual row carrying its reconciliation note', () => {
    const manual = buildManualStanding(
      'id-1',
      SCOPE,
      RULE,
      toManualStandingContent({
        competitionId: 'comp-1',
        entrantKind: StandingEntrantKind.Opponent,
        opponentId: 'opp-1',
        played: 1,
        wins: 0,
        losses: 1,
        ties: 0,
        pointsFor: 10,
        pointsAgainst: 15,
        reconciliationNote: 'organiser sheet',
        ruleKey: 'wfdf',
      }),
      TALLY,
      'user-1',
      NOW,
    );
    expect(manual.source).toBe(StandingSource.Manual);
    expect(manual.reconciliationNote).toBe('organiser sheet');
  });

  it('builds new and imported achievements', () => {
    const created = buildNewAchievement(
      'id-1',
      'team-1',
      toAchievementContent({
        category: AchievementCategory.Trophy,
        title: 'Champions',
        achievedOn: '2024-05-18',
      }),
      'manual',
      null,
      'user-1',
      NOW,
    );
    expect(created.importReference).toBeNull();
    const imported = buildImportedAchievement(
      'id-2',
      'team-1',
      toAchievementImportRow({
        reference: 'r-1',
        category: AchievementCategory.Placement,
        title: 'Third place',
        achievedOn: '2019-04-01',
      }),
      'user-1',
      NOW,
    );
    expect(imported.importReference).toBe('r-1');
    expect(imported.membershipId).toBeNull();
  });

  it('stamps only the instants an approval transition owns', () => {
    const approved = buildAchievementStatusChange(
      ACHIEVEMENT,
      AchievementStatus.Approved,
      'user-2',
      1,
      NOW,
    );
    expect(approved.approvedAt).toBe(NOW);
    expect(approved.rejectedAt).toBeNull();
    const rejected = buildAchievementStatusChange(
      ACHIEVEMENT,
      AchievementStatus.Rejected,
      'user-2',
      1,
      NOW,
    );
    expect(rejected.rejectedAt).toBe(NOW);
    const archived = buildAchievementStatusChange(
      ACHIEVEMENT,
      AchievementStatus.Archived,
      'user-2',
      1,
      NOW,
    );
    expect(archived.archivedAt).toBe(NOW);
  });

  it('audits provenance and never the description', () => {
    expect(buildRuleAudit('user-1', RULE).diff['ruleKey']).toBe('wfdf');
    expect(
      buildStandingAudit('standings.manual.recorded', 'user-1', STANDING).diff[
        'source'
      ],
    ).toBe(StandingSource.Derived);
    const audit = buildAchievementAudit(
      'achievement.created',
      'user-1',
      ACHIEVEMENT,
    );
    expect(JSON.stringify(audit.diff)).not.toContain('Won the final');
    const report = buildAchievementImportReport(true, 1, [
      buildAchievementRowResult('r-1', AchievementImportOutcome.Imported, null),
    ]);
    expect(
      buildAchievementImportAudit('user-1', 'team-1', report).diff['received'],
    ).toBe(1);
    expect(
      buildRecomputeAudit('standings.recomputed', 'user-1', SCOPE, {
        competitionId: 'comp-1',
        ruleVersionId: 'rule-1',
        finalizedMatches: 3,
        entrants: 2,
        rows: [],
      }).diff['finalizedMatches'],
    ).toBe(3);
  });

  it('publishes classification-only events', () => {
    expect(
      buildStandingsRecomputedEvent(
        SCOPE,
        {
          competitionId: 'comp-1',
          ruleVersionId: 'rule-1',
          finalizedMatches: 3,
          entrants: 2,
          rows: [],
        },
        'user-1',
      ).payload['entrants'],
    ).toBe(2);
    const approved = buildAchievementApprovedEvent(ACHIEVEMENT, 'user-2');
    expect(JSON.stringify(approved.payload)).not.toContain('Won the final');
  });
});

describe('achievement import reconciler', () => {
  it('rejects a broken formula cell instead of trusting it', () => {
    expect(hasCleanText('#REF!')).toBe(false);
    expect(hasCleanText('   ')).toBe(false);
    expect(hasCleanText('Champions')).toBe(true);
    expect(
      isImportableRow(
        toAchievementImportRow({
          reference: 'r-1',
          category: AchievementCategory.Trophy,
          title: '#N/A',
          achievedOn: '2020-01-01',
        }),
      ),
    ).toBe(false);
  });

  it('rejects a date that is not a real calendar day', () => {
    expect(isCalendarDay('2020-01-01')).toBe(true);
    expect(isCalendarDay('44197')).toBe(false);
    expect(isCalendarDay('2020-13-45')).toBe(false);
    expect(
      isImportableRow(
        toAchievementImportRow({
          reference: 'r-1',
          category: AchievementCategory.Trophy,
          title: 'Champions',
          achievedOn: '2020-01-01',
        }),
      ),
    ).toBe(true);
  });

  it('accounts for every received row exactly once', () => {
    const report = buildAchievementImportReport(false, 3, [
      buildAchievementRowResult('a', AchievementImportOutcome.Imported, 'x'),
      buildAchievementRowResult(
        'b',
        AchievementImportOutcome.SkippedDuplicate,
        'y',
      ),
      buildAchievementRowResult(
        'c',
        AchievementImportOutcome.RejectedInvalid,
        null,
      ),
    ]);
    expect(isBalancedAchievementReport(report)).toBe(true);
    expect(countOutcome(report.rows, AchievementImportOutcome.Imported)).toBe(
      1,
    );
    expect(
      isBalancedAchievementReport(buildAchievementImportReport(false, 5, [])),
    ).toBe(false);
  });
});
