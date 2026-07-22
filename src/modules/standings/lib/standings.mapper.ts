import {
  ACHIEVEMENT_CATEGORY_VALUES,
  ACHIEVEMENT_SOURCE_VALUES,
  ACHIEVEMENT_STATUS_VALUES,
  ACHIEVEMENT_VISIBILITY_VALUES,
  MATCH_OUTCOME_VALUES,
  STANDING_ENTRANT_KIND_VALUES,
  STANDING_QUALIFICATION_VALUES,
  STANDING_RULE_STATUS_VALUES,
  STANDING_SOURCE_VALUES,
  STANDING_TIE_BREAK_VALUES,
} from '../model/standings.enums';
import type {
  AchievementRow,
  FinalizedMatchRow,
  StandingRow,
  StandingsRuleRow,
} from '../model/standings.rows';
import type {
  Achievement,
  CompetitionStanding,
  FinalizedMatchResult,
  HistoryEntry,
  StandingsRuleVersion,
} from '../model/standings.types';
import {
  parseEnumValue,
  parseEnumValues,
  toCalendarDay,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './standings.helpers';

export function toStandingsRule(row: StandingsRuleRow): StandingsRuleVersion {
  return {
    ruleVersionId: row.id,
    teamId: row.team_id,
    ruleKey: row.rule_key,
    version: toNumber(row.version),
    name: row.name,
    winPoints: toNumber(row.win_points),
    lossPoints: toNumber(row.loss_points),
    tiePoints: toNumber(row.tie_points),
    tieBreakOrder: parseEnumValues(
      STANDING_TIE_BREAK_VALUES,
      row.tie_break_order,
      'tie break',
    ),
    effectiveFrom: toDate(row.effective_from),
    status: parseEnumValue(
      STANDING_RULE_STATUS_VALUES,
      row.status,
      'rule status',
    ),
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
  };
}

export function toStanding(row: StandingRow): CompetitionStanding {
  return {
    standingId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    stageId: row.stage_id,
    ruleVersionId: row.rule_version_id,
    poolLabel: row.pool_label,
    entrantKind: parseEnumValue(
      STANDING_ENTRANT_KIND_VALUES,
      row.entrant_kind,
      'entrant kind',
    ),
    opponentId: row.opponent_id,
    played: toNumber(row.played),
    wins: toNumber(row.wins),
    losses: toNumber(row.losses),
    ties: toNumber(row.ties),
    pointsFor: toNumber(row.points_for),
    pointsAgainst: toNumber(row.points_against),
    standingPoints: toNumber(row.standing_points),
    spiritScore: toNullableNumber(row.spirit_score),
    finalPlace: toNullableNumber(row.final_place),
    qualification: parseEnumValue(
      STANDING_QUALIFICATION_VALUES,
      row.qualification,
      'qualification',
    ),
    source: parseEnumValue(STANDING_SOURCE_VALUES, row.source, 'source'),
    sourceReference: row.source_reference,
    reconciliationNote: row.reconciliation_note,
    recordVersion: toNumber(row.record_version),
    recordedBy: row.recorded_by,
    computedAt: toDate(row.computed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toAchievement(row: AchievementRow): Achievement {
  return {
    achievementId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    membershipId: row.membership_id,
    category: parseEnumValue(
      ACHIEVEMENT_CATEGORY_VALUES,
      row.category,
      'category',
    ),
    title: row.title,
    description: row.description,
    achievedOn: toCalendarDay(row.achieved_on),
    evidenceReference: row.evidence_reference,
    visibility: parseEnumValue(
      ACHIEVEMENT_VISIBILITY_VALUES,
      row.visibility,
      'visibility',
    ),
    status: parseEnumValue(
      ACHIEVEMENT_STATUS_VALUES,
      row.status,
      'achievement status',
    ),
    source: parseEnumValue(ACHIEVEMENT_SOURCE_VALUES, row.source, 'source'),
    importReference: row.import_reference,
    recordVersion: toNumber(row.record_version),
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: toNullableDate(row.approved_at),
    rejectedAt: toNullableDate(row.rejected_at),
    archivedAt: toNullableDate(row.archived_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toFinalizedMatch(row: FinalizedMatchRow): FinalizedMatchResult {
  return {
    matchId: row.match_id,
    competitionId: row.competition_id,
    stageId: row.stage_id,
    opponentId: row.opponent_id,
    ourScore: toNumber(row.our_score),
    opponentScore: toNumber(row.opponent_score),
    result: parseEnumValue(MATCH_OUTCOME_VALUES, row.result, 'match result'),
  };
}

/**
 * Reduce an approved achievement to the privacy-safe cabinet entry: ids,
 * classification, title and date. No description, no evidence link, no member
 * profile detail ever crosses into the public history surface.
 */
export function toHistoryEntry(achievement: Achievement): HistoryEntry {
  return {
    achievementId: achievement.achievementId,
    seasonId: achievement.seasonId,
    competitionId: achievement.competitionId,
    membershipId: achievement.membershipId,
    category: achievement.category,
    title: achievement.title,
    achievedOn: achievement.achievedOn,
    visibility: achievement.visibility,
  };
}
