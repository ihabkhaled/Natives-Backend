import {
  DECISION_TEXT_MAX_LENGTH,
  DECISIONS_MAX,
  LIST_DEFAULT_LIMIT,
  LIST_DEFAULT_OFFSET,
  LIST_MAX_LIMIT,
} from '../model/governance.constants';
import type {
  MeetingDecision,
  PageRequest,
  RuleAcknowledgement,
  TeamRule,
  TeamRuleWithAckState,
} from '../model/governance.types';

export function resolveGovernancePage(
  limit: number | undefined,
  offset: number | undefined,
): PageRequest {
  return {
    limit: Math.min(limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT),
    offset: offset ?? LIST_DEFAULT_OFFSET,
  };
}

/**
 * Merge the caller's own acknowledgements into a page of rule version rows
 * (BE-2). An ack row cites one rule VERSION row, so a rule item carries a
 * non-null `myAcknowledgedVersion` exactly when the caller acknowledged that
 * version — acknowledging an older version never carries over.
 */
export function mergeRuleAckState(
  rules: readonly TeamRule[],
  acks: readonly RuleAcknowledgement[],
): readonly TeamRuleWithAckState[] {
  const byRuleId = new Map(acks.map(ack => [ack.ruleId, ack]));
  return rules.map(rule => toRuleAckState(rule, byRuleId.get(rule.ruleId)));
}

export function toRuleAckState(
  rule: TeamRule,
  ack: RuleAcknowledgement | undefined,
): TeamRuleWithAckState {
  return {
    ...rule,
    myAcknowledgedVersion: ack === undefined ? null : ack.ruleVersion,
    myAcknowledgedAt: ack === undefined ? null : ack.acknowledgedAt,
  };
}

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toNullableDate(value: string | Date | null): Date | null {
  return value === null ? null : toDate(value);
}

export function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Render a stored `date` column as an ISO calendar day, timezone-safe. */
export function toCalendarDay(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
}

export function toNullableCalendarDay(
  value: string | Date | null,
): string | null {
  return value === null ? null : toCalendarDay(value);
}

export function parseEnumValue<TValue extends string>(
  values: readonly TValue[],
  raw: string,
  label: string,
): TValue {
  const value = values.find(candidate => candidate === raw);
  if (value === undefined) {
    throw new Error(`Unrecognized ${label}: ${raw}`);
  }
  return value;
}

/**
 * Narrow the untyped jsonb decision register to a bounded, well-formed list.
 * Any malformed element is dropped rather than trusted, and the list is capped
 * so a meeting record can never carry an unbounded blob.
 */
export function toDecisions(value: unknown): readonly MeetingDecision[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => toDecision(item))
    .filter((item): item is MeetingDecision => item !== null)
    .slice(0, DECISIONS_MAX);
}

export function toDecision(value: unknown): MeetingDecision | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const fields = value as Record<string, unknown>;
  const ref = fields['ref'];
  const text = fields['text'];
  if (typeof ref !== 'string' || typeof text !== 'string') {
    return null;
  }
  return {
    ref: ref.slice(0, DECISION_TEXT_MAX_LENGTH),
    text: text.slice(0, DECISION_TEXT_MAX_LENGTH),
  };
}
