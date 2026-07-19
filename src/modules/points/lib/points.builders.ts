import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isPublishTarget,
  isRetireTarget,
} from '../domain/points-rule.state-machine';
import {
  BADGE_AGGREGATE,
  BADGE_EARNED_EVENT,
  LEDGER_AGGREGATE,
  LEDGER_RESOURCE_TYPE,
  POINTS_ADJUSTED_EVENT,
  POINTS_AWARDED_EVENT,
  POINTS_EVENT_VERSION,
  POINTS_REVERSED_EVENT,
  RULE_AGGREGATE,
  RULE_CREATED_EVENT,
  RULE_PUBLISHED_EVENT,
  RULE_RESOURCE_TYPE,
  RULE_RETIRED_EVENT,
} from '../model/points.constants';
import {
  LedgerEntryType,
  LedgerSourceType,
  type PointsRuleStatus,
} from '../model/points.enums';
import type {
  ActivityAwardCommand,
  ActivityReversalCommand,
  AdjustmentCommand,
  BadgeDefinition,
  BadgeScope,
  LedgerEntry,
  NewLedgerEntry,
  NewPlayerBadge,
  NewPointsRule,
  PointsRule,
  RuleContent,
  RuleStatusChange,
} from '../model/points.types';
import {
  buildAdjustmentKey,
  buildAwardKey,
  buildReversalKey,
  toIsoDate,
} from './points.helpers';

// --- Rule rows ---------------------------------------------------------------

/** Build a DRAFT rule row from a create command. */
export function buildNewRule(
  id: string,
  teamId: string,
  version: number,
  content: RuleContent,
  actorUserId: string,
  now: Date,
): NewPointsRule {
  return { id, teamId, version, content, createdBy: actorUserId, now };
}

/**
 * Build the optimistic-version-guarded status change for a rule transition,
 * stamping publication/retirement instants only for the targets that own them and
 * preserving the existing publication trail otherwise.
 */
export function buildRuleStatusChange(
  rule: PointsRule,
  teamId: string,
  target: PointsRuleStatus,
  actorUserId: string,
  expectedRecordVersion: number,
  now: Date,
): RuleStatusChange {
  const publishing = isPublishTarget(target);
  return {
    id: rule.ruleId,
    teamId,
    expectedRecordVersion,
    toStatus: target,
    publishedBy: publishing ? actorUserId : rule.publishedBy,
    publishedAt: publishing ? now : rule.publishedAt,
    retiredAt: isRetireTarget(target) ? now : null,
    now,
  };
}

// --- Ledger rows -------------------------------------------------------------

/** Build the AWARD entry for an approved activity claim under a published rule. */
export function buildAwardEntry(
  id: string,
  command: ActivityAwardCommand,
  rule: PointsRule,
  category: string,
  amount: number,
  now: Date,
): NewLedgerEntry {
  return {
    id,
    teamId: command.teamId,
    seasonId: command.seasonId,
    membershipId: command.membershipId,
    entryType: LedgerEntryType.Award,
    amount,
    sourceType: LedgerSourceType.ActivitySubmission,
    sourceId: command.submissionId,
    ruleId: rule.ruleId,
    ruleVersion: rule.version,
    activityCategory: category,
    reason: null,
    reasonKey: null,
    reversesEntryId: null,
    idempotencyKey: buildAwardKey(command.submissionId, rule.ruleId),
    effectiveOn: command.performedOn,
    actorUserId: command.actorUserId,
    now,
  };
}

/** Build the compensating REVERSAL entry that exactly offsets an awarded entry. */
export function buildReversalEntry(
  id: string,
  command: ActivityReversalCommand,
  award: LedgerEntry,
  now: Date,
): NewLedgerEntry {
  return {
    id,
    teamId: award.teamId,
    seasonId: award.seasonId,
    membershipId: award.membershipId,
    entryType: LedgerEntryType.Reversal,
    amount: -award.amount,
    sourceType: award.sourceType,
    sourceId: award.sourceId,
    ruleId: award.ruleId,
    ruleVersion: award.ruleVersion,
    activityCategory: award.activityCategory,
    reason: null,
    reasonKey: null,
    reversesEntryId: award.id,
    idempotencyKey: buildReversalKey(award.id),
    effectiveOn: toIsoDate(now),
    actorUserId: command.actorUserId,
    now,
  };
}

/** Build a MANUAL_ADJUSTMENT entry from an audited, reasoned admin command. */
export function buildAdjustmentEntry(
  id: string,
  teamId: string,
  membershipId: string,
  command: AdjustmentCommand,
  actorUserId: string,
  now: Date,
): NewLedgerEntry {
  return {
    id,
    teamId,
    seasonId: null,
    membershipId,
    entryType: LedgerEntryType.ManualAdjustment,
    amount: command.amount,
    sourceType: LedgerSourceType.Manual,
    sourceId: null,
    ruleId: null,
    ruleVersion: null,
    activityCategory: null,
    reason: command.reason,
    reasonKey: null,
    reversesEntryId: null,
    idempotencyKey: buildAdjustmentKey(membershipId, command.operationKey),
    effectiveOn: toIsoDate(now),
    actorUserId,
    now,
  };
}

/** Build the player-badge row for a member that has crossed a tier threshold. */
export function buildPlayerBadge(
  id: string,
  scope: BadgeScope,
  definition: BadgeDefinition,
  total: number,
  now: Date,
): NewPlayerBadge {
  return {
    id,
    teamId: scope.teamId,
    membershipId: scope.membershipId,
    badgeDefinitionId: definition.id,
    badgeKey: definition.badgeKey,
    threshold: definition.threshold,
    pointsAtAward: total,
    awardedBy: scope.actorUserId,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

export function buildLedgerAudit(
  action: string,
  actorUserId: string | null,
  entry: LedgerEntry,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: LEDGER_RESOURCE_TYPE,
    resourceId: entry.id,
    teamId: entry.teamId,
    seasonId: entry.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      entryType: entry.entryType,
      amount: entry.amount,
      membershipId: entry.membershipId,
      sourceId: entry.sourceId,
    },
  };
}

export function buildRuleAudit(
  action: string,
  actorUserId: string,
  rule: PointsRule,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: RULE_RESOURCE_TYPE,
    resourceId: rule.ruleId,
    teamId: rule.teamId,
    seasonId: rule.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: rule.status,
      version: rule.version,
      recordVersion: rule.recordVersion,
    },
  };
}

// --- Domain events (privacy-safe scalar payloads) ----------------------------

export function buildPointsAwardedEvent(entry: LedgerEntry): DomainEventInput {
  return ledgerEvent(POINTS_AWARDED_EVENT, entry);
}

export function buildPointsReversedEvent(entry: LedgerEntry): DomainEventInput {
  return ledgerEvent(POINTS_REVERSED_EVENT, entry);
}

export function buildPointsAdjustedEvent(entry: LedgerEntry): DomainEventInput {
  return ledgerEvent(POINTS_ADJUSTED_EVENT, entry);
}

export function buildBadgeEarnedEvent(
  scope: BadgeScope,
  definition: BadgeDefinition,
  total: number,
): DomainEventInput {
  return {
    aggregateType: BADGE_AGGREGATE,
    aggregateId: definition.id,
    eventType: BADGE_EARNED_EVENT,
    eventVersion: POINTS_EVENT_VERSION,
    actorUserId: scope.actorUserId,
    teamId: scope.teamId,
    seasonId: null,
    correlationId: null,
    causationId: null,
    payload: {
      membershipId: scope.membershipId,
      badgeKey: definition.badgeKey,
      threshold: definition.threshold,
      total,
    },
  };
}

export function buildRuleCreatedEvent(
  rule: PointsRule,
  actorUserId: string,
): DomainEventInput {
  return ruleEvent(RULE_CREATED_EVENT, rule, actorUserId);
}

export function buildRulePublishedEvent(
  rule: PointsRule,
  actorUserId: string,
): DomainEventInput {
  return ruleEvent(RULE_PUBLISHED_EVENT, rule, actorUserId);
}

export function buildRuleRetiredEvent(
  rule: PointsRule,
  actorUserId: string,
): DomainEventInput {
  return ruleEvent(RULE_RETIRED_EVENT, rule, actorUserId);
}

function ledgerEvent(eventType: string, entry: LedgerEntry): DomainEventInput {
  return {
    aggregateType: LEDGER_AGGREGATE,
    aggregateId: entry.id,
    eventType,
    eventVersion: POINTS_EVENT_VERSION,
    actorUserId: entry.actorUserId,
    teamId: entry.teamId,
    seasonId: entry.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      membershipId: entry.membershipId,
      entryType: entry.entryType,
      amount: entry.amount,
      ruleVersion: entry.ruleVersion,
    },
  };
}

function ruleEvent(
  eventType: string,
  rule: PointsRule,
  actorUserId: string | null,
): DomainEventInput {
  return {
    aggregateType: RULE_AGGREGATE,
    aggregateId: rule.ruleId,
    eventType,
    eventVersion: POINTS_EVENT_VERSION,
    actorUserId,
    teamId: rule.teamId,
    seasonId: rule.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      ruleKey: rule.ruleKey,
      ruleVersion: rule.version,
      status: rule.status,
    },
  };
}
