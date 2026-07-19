import {
  BADGE_STATUS_VALUES,
  LEDGER_ENTRY_TYPE_VALUES,
  LEDGER_SOURCE_TYPE_VALUES,
  POINTS_APPROVAL_VALUES,
  POINTS_RULE_STATUS_VALUES,
} from '../model/points.enums';
import type {
  ActivityTypePointsRow,
  BadgeDefinitionRow,
  LeaderboardRowRaw,
  LedgerEntryRow,
  PlayerBadgeRow,
  PointsRuleRow,
} from '../model/points.rows';
import type {
  ActivityTypePoints,
  BadgeDefinition,
  LeaderboardRow,
  LedgerEntry,
  LedgerEntryView,
  PlayerBadge,
  PlayerBadgeView,
  PointsRule,
  RulePointEntry,
} from '../model/points.types';
import {
  computeRank,
  parseEnumValue,
  toDate,
  toNullableNumber,
  toNumber,
  toTotal,
} from './points.helpers';

interface RawPointEntry {
  readonly activityCategory: string;
  readonly points: number | null;
  readonly dailyCap: number | null;
  readonly cooldownDays: number | null;
}

export function toPointsRule(row: PointsRuleRow): PointsRule {
  return {
    ruleId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    ruleKey: row.rule_key,
    version: row.version,
    name: row.name,
    description: row.description,
    status: parseEnumValue(
      POINTS_RULE_STATUS_VALUES,
      row.status,
      'points rule status',
    ),
    pointEntries: parsePointEntries(row.point_entries),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    recordVersion: row.record_version,
    createdBy: row.created_by,
    publishedBy: row.published_by,
    publishedAt: row.published_at === null ? null : toDate(row.published_at),
    retiredAt: row.retired_at === null ? null : toDate(row.retired_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    membershipId: row.membership_id,
    entryType: parseEnumValue(
      LEDGER_ENTRY_TYPE_VALUES,
      row.entry_type,
      'ledger entry type',
    ),
    amount: toNumber(row.amount),
    sourceType: parseEnumValue(
      LEDGER_SOURCE_TYPE_VALUES,
      row.source_type,
      'ledger source type',
    ),
    sourceId: row.source_id,
    ruleId: row.rule_id,
    ruleVersion: row.rule_version,
    activityCategory: row.activity_category,
    reason: row.reason,
    reasonKey: row.reason_key,
    reversesEntryId: row.reverses_entry_id,
    idempotencyKey: row.idempotency_key,
    effectiveOn: row.effective_on,
    actorUserId: row.actor_user_id,
    createdAt: toDate(row.created_at),
  };
}

export function toBadgeDefinition(row: BadgeDefinitionRow): BadgeDefinition {
  return {
    id: row.id,
    teamId: row.team_id,
    badgeKey: row.badge_key,
    name: row.name,
    description: row.description,
    threshold: row.threshold,
    status: parseEnumValue(BADGE_STATUS_VALUES, row.status, 'badge status'),
    icon: row.icon,
  };
}

export function toPlayerBadge(row: PlayerBadgeRow): PlayerBadge {
  return {
    id: row.id,
    teamId: row.team_id,
    membershipId: row.membership_id,
    badgeDefinitionId: row.badge_definition_id,
    badgeKey: row.badge_key,
    threshold: row.threshold,
    pointsAtAward: toNumber(row.points_at_award),
    awardedBy: row.awarded_by,
    awardedAt: toDate(row.awarded_at),
  };
}

export function toActivityTypePoints(
  row: ActivityTypePointsRow,
): ActivityTypePoints {
  return {
    activityTypeId: row.id,
    category: row.category,
    pointsApproval: parseEnumValue(
      POINTS_APPROVAL_VALUES,
      row.points_approval,
      'activity points approval',
    ),
  };
}

export function toLeaderboardRow(
  row: LeaderboardRowRaw,
  offset: number,
  index: number,
): LeaderboardRow {
  return {
    membershipId: row.membership_id,
    total: toTotal(row.total),
    rank: computeRank(offset, index),
    badgeCount: toNumber(row.badge_count),
  };
}

export function toLedgerEntryView(entry: LedgerEntry): LedgerEntryView {
  return {
    id: entry.id,
    entryType: entry.entryType,
    amount: entry.amount,
    sourceType: entry.sourceType,
    ruleVersion: entry.ruleVersion,
    activityCategory: entry.activityCategory,
    reason: entry.reason,
    effectiveOn: entry.effectiveOn,
    createdAt: entry.createdAt,
  };
}

export function toPlayerBadgeView(badge: PlayerBadge): PlayerBadgeView {
  return {
    badgeKey: badge.badgeKey,
    threshold: badge.threshold,
    pointsAtAward: badge.pointsAtAward,
    awardedAt: badge.awardedAt,
  };
}

export function parsePointEntries(raw: unknown): readonly RulePointEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map(entry => toPointEntry(entry as RawPointEntry));
}

function toPointEntry(entry: RawPointEntry): RulePointEntry {
  return {
    activityCategory: entry.activityCategory,
    points: toNullableNumber(
      entry.points === null ? null : String(entry.points),
    ),
    dailyCap: entry.dailyCap,
    cooldownDays: entry.cooldownDays,
  };
}
