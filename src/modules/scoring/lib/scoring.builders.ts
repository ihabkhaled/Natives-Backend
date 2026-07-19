import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  isPublishTarget,
  isRetireTarget,
} from '../domain/calculation-rule.state-machine';
import {
  computeCategoryScore,
  computePerformanceScore,
} from '../domain/performance-score.engine';
import {
  PROJECTION_AGGREGATE,
  PROJECTION_REBUILT_EVENT,
  PROJECTION_REQUESTED_EVENT,
  RULE_AGGREGATE,
  RULE_CREATED_EVENT,
  RULE_PUBLISHED_EVENT,
  RULE_RESOURCE_TYPE,
  RULE_RETIRED_EVENT,
  SCORING_EVENT_VERSION,
} from '../model/scoring.constants';
import type { CalculationRuleStatus } from '../model/scoring.enums';
import type { CategorySourceRow } from '../model/scoring.rows';
import type {
  CalculationRule,
  CategoryInput,
  CategorySource,
  ComputedProjection,
  NewCalculationRule,
  ProjectionTarget,
  RebuildOutcome,
  RuleContent,
  RuleStatusChange,
  ScoreRuleDefinition,
} from '../model/scoring.types';
import { buildScoreExplanation } from './score-explanation.builder';
import { buildSourceHash } from './scoring.helpers';
import { toCategorySource } from './scoring.mapper';

/** Build a DRAFT rule row from a create command. */
export function buildNewRule(
  id: string,
  teamId: string,
  version: number,
  content: RuleContent,
  actorUserId: string,
  now: Date,
): NewCalculationRule {
  return { id, teamId, version, content, createdBy: actorUserId, now };
}

/**
 * Turn per-category source facts into the overall calculation's category inputs.
 * A category with no source resolves to a null value (excluded, never zero); a
 * present category is the equal-weight mean of its assessed metrics, with missing
 * observations carried as excluded nulls so coverage is honest.
 */
export function buildCategoryInputs(
  rule: ScoreRuleDefinition,
  sources: readonly CategorySource[],
): readonly CategoryInput[] {
  const byKey = new Map(sources.map(source => [source.categoryKey, source]));
  return rule.components.map(component => {
    const source = byKey.get(component.categoryKey);
    if (source === undefined) {
      return {
        categoryKey: component.categoryKey,
        value: null,
        assessedMetrics: 0,
        totalMetrics: 0,
      };
    }
    return categoryInputFromSource(component.categoryKey, source);
  });
}

function categoryInputFromSource(
  categoryKey: CategoryInput['categoryKey'],
  source: CategorySource,
): CategoryInput {
  const missing = Math.max(source.totalMetrics - source.values.length, 0);
  const metricValues: readonly (number | null)[] = [
    ...source.values,
    ...Array.from({ length: missing }, () => null),
  ];
  return {
    categoryKey,
    value: computeCategoryScore(metricValues).value,
    assessedMetrics: source.values.length,
    totalMetrics: source.totalMetrics,
  };
}

/**
 * Compute a full projection for one membership from source facts. Pure: runs the
 * engine, builds the explanation, and fingerprints the source so an idempotent
 * rebuild reproduces the identical result.
 */
export function computeMembershipProjection(
  rule: CalculationRule,
  target: ProjectionTarget,
  sources: readonly CategorySource[],
  now: Date,
): ComputedProjection {
  const inputs = buildCategoryInputs(rule, sources);
  const result = computePerformanceScore(rule, inputs);
  return {
    id: target.id,
    teamId: target.teamId,
    seasonId: target.seasonId,
    membershipId: target.membershipId,
    periodId: target.periodId,
    rule,
    result,
    explanation: buildScoreExplanation(rule, result),
    sourceHash: buildSourceHash(rule.ruleId, rule.version, inputs),
    now,
  };
}

/**
 * Build the optimistic-version-guarded status change for a rule transition,
 * stamping publication/retirement instants only for the targets that own them and
 * preserving the existing publication trail otherwise.
 */
export function buildStatusChange(
  rule: CalculationRule,
  teamId: string,
  target: CalculationRuleStatus,
  actorUserId: string,
  expectedRecordVersion: number,
  now: Date,
): RuleStatusChange {
  const publishing = isPublishTarget(target);
  const retiring = isRetireTarget(target);
  return {
    id: rule.ruleId,
    teamId,
    expectedRecordVersion,
    toStatus: target,
    publishedBy: publishing ? actorUserId : rule.publishedBy,
    publishedAt: publishing ? now : rule.publishedAt,
    retiredAt: retiring ? now : null,
    now,
  };
}

/** Group aggregated source rows by membership into typed category sources. */
export function groupSourcesByMembership(
  rows: readonly CategorySourceRow[],
): ReadonlyMap<string, readonly CategorySource[]> {
  const map = new Map<string, CategorySource[]>();
  for (const row of rows) {
    const mapped = toCategorySource(row);
    const bucket = map.get(mapped.membershipId) ?? [];
    bucket.push(mapped.source);
    map.set(mapped.membershipId, bucket);
  }
  return map;
}

export function buildRuleAudit(
  action: string,
  actorUserId: string,
  rule: CalculationRule,
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

export function buildRebuildAudit(
  action: string,
  actorUserId: string,
  outcome: RebuildOutcome,
  teamId: string,
  seasonId: string | null,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: PROJECTION_AGGREGATE,
    resourceId: outcome.ruleId,
    teamId,
    seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      rebuilt: outcome.rebuilt,
      failed: outcome.failed,
      scanned: outcome.scanned,
      ruleVersion: outcome.ruleVersion,
    },
  };
}

export function buildRuleCreatedEvent(
  rule: CalculationRule,
  actorUserId: string,
): DomainEventInput {
  return ruleEvent(RULE_CREATED_EVENT, rule, actorUserId);
}

export function buildRulePublishedEvent(
  rule: CalculationRule,
  actorUserId: string,
): DomainEventInput {
  return ruleEvent(RULE_PUBLISHED_EVENT, rule, actorUserId);
}

export function buildRuleRetiredEvent(
  rule: CalculationRule,
  actorUserId: string,
): DomainEventInput {
  return ruleEvent(RULE_RETIRED_EVENT, rule, actorUserId);
}

export function buildProjectionRequestedEvent(
  rule: CalculationRule,
  actorUserId: string,
): DomainEventInput {
  return {
    aggregateType: PROJECTION_AGGREGATE,
    aggregateId: rule.ruleId,
    eventType: PROJECTION_REQUESTED_EVENT,
    eventVersion: SCORING_EVENT_VERSION,
    actorUserId,
    teamId: rule.teamId,
    seasonId: rule.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      ruleId: rule.ruleId,
      ruleKey: rule.ruleKey,
      ruleVersion: rule.version,
    },
  };
}

export function buildProjectionRebuiltEvent(
  actorUserId: string | null,
  teamId: string,
  seasonId: string | null,
  outcome: RebuildOutcome,
): DomainEventInput {
  return {
    aggregateType: PROJECTION_AGGREGATE,
    aggregateId: outcome.ruleId,
    eventType: PROJECTION_REBUILT_EVENT,
    eventVersion: SCORING_EVENT_VERSION,
    actorUserId,
    teamId,
    seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      ruleId: outcome.ruleId,
      ruleVersion: outcome.ruleVersion,
      rebuilt: outcome.rebuilt,
      failed: outcome.failed,
    },
  };
}

function ruleEvent(
  eventType: string,
  rule: CalculationRule,
  actorUserId: string | null,
): DomainEventInput {
  return {
    aggregateType: RULE_AGGREGATE,
    aggregateId: rule.ruleId,
    eventType,
    eventVersion: SCORING_EVENT_VERSION,
    actorUserId,
    teamId: rule.teamId,
    seasonId: rule.seasonId,
    correlationId: null,
    causationId: null,
    payload: {
      ruleId: rule.ruleId,
      ruleKey: rule.ruleKey,
      ruleVersion: rule.version,
      status: rule.status,
    },
  };
}
