import type { AuditInput, DomainEventInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import { isAbandonTarget } from '../domain/match.state-machine';
import { resolveResult } from '../domain/match-score.policy';
import {
  FIRST_REVISION,
  MATCH_AGGREGATE,
  MATCH_ENGINE_VERSION,
  MATCH_EVENT_RESOURCE_TYPE,
  MATCH_FINALIZED_EVENT,
  MATCH_REOPENED_EVENT,
  MATCH_RESOURCE_TYPE,
  MATCH_REVISION_RESOURCE_TYPE,
  MATCH_RULESET_CREATED_ACTION,
  MATCH_RULESET_RESOURCE_TYPE,
  MATCH_STARTED_EVENT,
  MATCH_STATE_CHANGED_EVENT,
  MATCHES_EVENT_VERSION,
} from '../model/matches.constants';
import type { CapKind, MatchRevisionAction } from '../model/matches.enums';
import {
  MatchEventType,
  MatchResult,
  MatchStatus,
} from '../model/matches.enums';
import type {
  Match,
  MatchEvent,
  MatchFinalization,
  MatchReopening,
  MatchRevision,
  MatchRuleset,
  MatchRulesetContent,
  MatchScope,
  MatchScoreUpdate,
  MatchStatusChange,
  NewMatch,
  NewMatchEvent,
  NewMatchRevision,
  NewMatchRuleset,
  PointContent,
  ScorePair,
  TimeoutContent,
  VoidContent,
} from '../model/matches.types';

// --- Row builders ------------------------------------------------------------

/** A brand-new match against a fixture: revision 1, 0–0, nothing stamped. */
export function buildNewMatch(
  id: string,
  teamId: string,
  scope: MatchScope,
  fixtureId: string,
  rosterId: string | null,
  rulesetId: string,
  notes: string | null,
  actorUserId: string,
  now: Date,
): NewMatch {
  return {
    id,
    teamId,
    seasonId: scope.seasonId,
    competitionId: scope.competitionId,
    fixtureId,
    rosterId,
    rulesetId,
    homeAway: scope.homeAway,
    engineVersion: MATCH_ENGINE_VERSION,
    revision: FIRST_REVISION,
    supersedesMatchId: null,
    notes,
    createdBy: actorUserId,
    now,
  };
}

/** A new version of a named ruleset. Published versions are never edited. */
export function buildNewMatchRuleset(
  id: string,
  teamId: string,
  content: MatchRulesetContent,
  rulesetVersion: number,
  actorUserId: string,
  now: Date,
): NewMatchRuleset {
  return {
    ...content,
    id,
    teamId,
    rulesetVersion,
    createdBy: actorUserId,
    now,
  };
}

/**
 * Build the optimistic-version-guarded status change, stamping only the instants
 * the target owns, preserving every instant already recorded, advancing the
 * period when play resumes from halftime, and settling the result only when play
 * actually completes (an abandoned match stays UNDECIDED — never a loss).
 */
export function buildMatchStatusChange(
  match: Match,
  target: MatchStatus,
  expectedRecordVersion: number,
  reason: string | null,
  now: Date,
): MatchStatusChange {
  return {
    id: match.matchId,
    teamId: match.teamId,
    expectedRecordVersion,
    toStatus: target,
    period: resolvePeriod(match, target),
    result: resolveStatusResult(match, target),
    startedAt: isFirstStart(match, target) ? now : match.startedAt,
    pausedAt: target === MatchStatus.Paused ? now : match.pausedAt,
    resumedAt: isResumption(match, target) ? now : match.resumedAt,
    halftimeAt: target === MatchStatus.Halftime ? now : match.halftimeAt,
    completedAt: target === MatchStatus.Completed ? now : match.completedAt,
    abandonedAt: isAbandonTarget(target) ? now : match.abandonedAt,
    abandonReason: isAbandonTarget(target) ? reason : match.abandonReason,
    now,
  };
}

/** The publication of an authoritative result under a version guard. */
export function buildMatchFinalization(
  match: Match,
  expectedRecordVersion: number,
  actorUserId: string,
  now: Date,
): MatchFinalization {
  return {
    id: match.matchId,
    teamId: match.teamId,
    expectedRecordVersion,
    result: resolveResult(toScore(match)),
    finalizedBy: actorUserId,
    now,
  };
}

/**
 * The audited reopening of a finalized match. Bumping the revision is what the
 * database trigger accepts as a lawful correction — every other update to a
 * finalized row is rejected outright.
 */
export function buildMatchReopening(
  match: Match,
  expectedRecordVersion: number,
  revision: number,
  reason: string,
  actorUserId: string,
  now: Date,
): MatchReopening {
  return {
    id: match.matchId,
    teamId: match.teamId,
    expectedRecordVersion,
    revision,
    reason,
    reopenedBy: actorUserId,
    now,
  };
}

/** The score projection write that follows an accepted stream append. */
export function buildMatchScoreUpdate(
  match: Match,
  score: ScorePair,
  streamVersion: number,
  capApplied: CapKind,
  now: Date,
): MatchScoreUpdate {
  return {
    id: match.matchId,
    teamId: match.teamId,
    ourScore: score.ourScore,
    opponentScore: score.opponentScore,
    streamVersion,
    capApplied,
    now,
  };
}

/** An accepted point on the append-only stream. */
export function buildPointEvent(
  id: string,
  match: Match,
  content: PointContent,
  requestHash: string,
  sequence: number,
  score: ScorePair,
  occurredAt: Date | null,
  actorUserId: string,
  now: Date,
): NewMatchEvent {
  return {
    ...streamBase(id, match, content.operationId, requestHash, sequence, score),
    eventType: MatchEventType.Point,
    scoringSide: content.scoringSide,
    points: content.points,
    scorerMembershipId: content.scorerMembershipId,
    assistMembershipId: content.assistMembershipId,
    voidsEventId: null,
    voidReason: null,
    recordedBy: actorUserId,
    occurredAt,
    now,
  };
}

/** An accepted timeout on the append-only stream. The score is unchanged. */
export function buildTimeoutEvent(
  id: string,
  match: Match,
  content: TimeoutContent,
  requestHash: string,
  sequence: number,
  occurredAt: Date | null,
  actorUserId: string,
  now: Date,
): NewMatchEvent {
  return {
    ...streamBase(
      id,
      match,
      content.operationId,
      requestHash,
      sequence,
      toScore(match),
    ),
    eventType: MatchEventType.Timeout,
    scoringSide: content.scoringSide,
    points: null,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: null,
    voidReason: null,
    recordedBy: actorUserId,
    occurredAt,
    now,
  };
}

/**
 * A compensating void. History is never deleted or rewritten: the original fact
 * stays on the stream and this new fact records that it no longer counts, along
 * with the score the reversal leaves behind.
 */
export function buildVoidEvent(
  id: string,
  match: Match,
  content: VoidContent,
  requestHash: string,
  sequence: number,
  score: ScorePair,
  actorUserId: string,
  now: Date,
): NewMatchEvent {
  return {
    ...streamBase(id, match, content.operationId, requestHash, sequence, score),
    eventType: MatchEventType.Void,
    scoringSide: null,
    points: null,
    scorerMembershipId: null,
    assistMembershipId: null,
    voidsEventId: content.eventId,
    voidReason: content.reason,
    recordedBy: actorUserId,
    occurredAt: null,
    now,
  };
}

/** One immutable revision row, carrying the score before and after. */
export function buildNewMatchRevision(
  id: string,
  sequence: number,
  match: Match,
  action: MatchRevisionAction,
  reason: string,
  fromStatus: MatchStatus,
  before: ScorePair,
  actorUserId: string,
  now: Date,
): NewMatchRevision {
  return {
    id,
    matchId: match.matchId,
    teamId: match.teamId,
    sequence,
    revision: match.revision,
    action,
    reason,
    fromStatus,
    toStatus: match.status,
    ourScoreBefore: before.ourScore,
    opponentScoreBefore: before.opponentScore,
    ourScoreAfter: match.ourScore,
    opponentScoreAfter: match.opponentScore,
    streamVersion: match.streamVersion,
    actorUserId,
    now,
  };
}

/** The score pair currently projected onto a match record. */
export function toScore(match: Match): ScorePair {
  return { ourScore: match.ourScore, opponentScore: match.opponentScore };
}

// --- Audit -------------------------------------------------------------------

export function buildMatchAudit(
  action: string,
  actorUserId: string,
  match: Match,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: MATCH_RESOURCE_TYPE,
    resourceId: match.matchId,
    teamId: match.teamId,
    seasonId: match.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: match.status,
      ourScore: match.ourScore,
      opponentScore: match.opponentScore,
      revision: match.revision,
      streamVersion: match.streamVersion,
      recordVersion: match.recordVersion,
    },
  };
}

/**
 * Audit a stream append. The diff carries the operation id and the resulting
 * score so an offline replay is traceable end to end, and never a player name or
 * any other personal detail.
 */
export function buildEventAudit(
  action: string,
  actorUserId: string,
  match: Match,
  event: MatchEvent,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: MATCH_EVENT_RESOURCE_TYPE,
    resourceId: event.eventId,
    teamId: match.teamId,
    seasonId: match.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      matchId: match.matchId,
      operationId: event.operationId,
      eventType: event.eventType,
      sequence: event.sequence,
      ourScoreAfter: event.ourScoreAfter,
      opponentScoreAfter: event.opponentScoreAfter,
    },
  };
}

export function buildRevisionAudit(
  action: string,
  actorUserId: string,
  revision: MatchRevision,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: MATCH_REVISION_RESOURCE_TYPE,
    resourceId: revision.revisionId,
    teamId: revision.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      matchId: revision.matchId,
      revision: revision.revision,
      revisionAction: revision.action,
      ourScoreBefore: revision.ourScoreBefore,
      opponentScoreBefore: revision.opponentScoreBefore,
      ourScoreAfter: revision.ourScoreAfter,
      opponentScoreAfter: revision.opponentScoreAfter,
    },
  };
}

export function buildRulesetAudit(
  actorUserId: string,
  ruleset: MatchRuleset,
): AuditInput {
  return {
    actorUserId,
    action: MATCH_RULESET_CREATED_ACTION,
    resourceType: MATCH_RULESET_RESOURCE_TYPE,
    resourceId: ruleset.rulesetId,
    teamId: ruleset.teamId,
    seasonId: ruleset.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      rulesetKey: ruleset.rulesetKey,
      rulesetVersion: ruleset.rulesetVersion,
      gameTo: ruleset.gameTo,
      hardCap: ruleset.hardCap,
      timeCapMinutes: ruleset.timeCapMinutes,
    },
  };
}

// --- Domain events (past-tense, versioned, privacy-safe payloads) ------------

export function buildMatchStartedEvent(
  match: Match,
  actorUserId: string,
): DomainEventInput {
  return {
    ...matchEvent(MATCH_STARTED_EVENT, match, actorUserId),
    payload: { ...scopePayload(match), startedAt: instant(match.startedAt) },
  };
}

export function buildMatchStateChangedEvent(
  match: Match,
  fromStatus: MatchStatus,
  actorUserId: string,
): DomainEventInput {
  return {
    ...matchEvent(MATCH_STATE_CHANGED_EVENT, match, actorUserId),
    payload: {
      ...scopePayload(match),
      fromStatus,
      toStatus: match.status,
      period: match.period,
    },
  };
}

/**
 * `match.finalized` publishes the authoritative result. The payload carries the
 * exact score and stream version it was derived from, so a downstream projection
 * can prove which stream produced it rather than re-deriving one.
 */
export function buildMatchFinalizedEvent(
  match: Match,
  actorUserId: string,
): DomainEventInput {
  return {
    ...matchEvent(MATCH_FINALIZED_EVENT, match, actorUserId),
    payload: {
      ...scopePayload(match),
      result: match.result,
      streamVersion: match.streamVersion,
      finalizedAt: instant(match.finalizedAt),
    },
  };
}

export function buildMatchReopenedEvent(
  match: Match,
  previousScore: ScorePair,
  actorUserId: string,
): DomainEventInput {
  return {
    ...matchEvent(MATCH_REOPENED_EVENT, match, actorUserId),
    payload: {
      ...scopePayload(match),
      previousOurScore: previousScore.ourScore,
      previousOpponentScore: previousScore.opponentScore,
      revision: match.revision,
    },
  };
}

function matchEvent(
  eventType: string,
  match: Match,
  actorUserId: string,
): Omit<DomainEventInput, 'payload'> {
  return {
    aggregateType: MATCH_AGGREGATE,
    aggregateId: match.matchId,
    eventType,
    eventVersion: MATCHES_EVENT_VERSION,
    actorUserId,
    teamId: match.teamId,
    seasonId: match.seasonId,
    correlationId: null,
    causationId: null,
  };
}

function scopePayload(match: Match): Record<string, string | number | null> {
  return {
    competitionId: match.competitionId,
    fixtureId: match.fixtureId,
    status: match.status,
    ourScore: match.ourScore,
    opponentScore: match.opponentScore,
  };
}

function streamBase(
  id: string,
  match: Match,
  operationId: string,
  requestHash: string,
  sequence: number,
  score: ScorePair,
): Omit<
  NewMatchEvent,
  | 'eventType'
  | 'scoringSide'
  | 'points'
  | 'scorerMembershipId'
  | 'assistMembershipId'
  | 'voidsEventId'
  | 'voidReason'
  | 'recordedBy'
  | 'occurredAt'
  | 'now'
> {
  return {
    id,
    matchId: match.matchId,
    teamId: match.teamId,
    sequence,
    operationId,
    requestHash,
    ourScoreAfter: score.ourScore,
    opponentScoreAfter: score.opponentScore,
    period: match.period,
  };
}

function resolvePeriod(match: Match, target: MatchStatus): number {
  const resuming =
    match.status === MatchStatus.Halftime && target === MatchStatus.Live;
  return resuming ? match.period + 1 : match.period;
}

function resolveStatusResult(match: Match, target: MatchStatus): MatchResult {
  if (target === MatchStatus.Completed) {
    return resolveResult(toScore(match));
  }
  if (isAbandonTarget(target)) {
    return MatchResult.Undecided;
  }
  return match.result;
}

function isFirstStart(match: Match, target: MatchStatus): boolean {
  return target === MatchStatus.Live && match.startedAt === null;
}

function isResumption(match: Match, target: MatchStatus): boolean {
  return target === MatchStatus.Live && match.startedAt !== null;
}

function instant(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
