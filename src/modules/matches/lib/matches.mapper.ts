import {
  CAP_KIND_VALUES,
  MATCH_EVENT_TYPE_VALUES,
  MATCH_RESULT_VALUES,
  MATCH_REVISION_ACTION_VALUES,
  MATCH_STATUS_VALUES,
  RULESET_STATUS_VALUES,
  SCORING_SIDE_VALUES,
} from '../model/matches.enums';
import type {
  MatchEventRow,
  MatchRevisionRow,
  MatchRow,
  MatchRulesetRow,
  MatchScopeRow,
} from '../model/matches.rows';
import type {
  Match,
  MatchEvent,
  MatchRevision,
  MatchRuleset,
  MatchScope,
} from '../model/matches.types';
import {
  parseEnumValue,
  parseNullableEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './matches.helpers';

export function toMatch(row: MatchRow): Match {
  return {
    matchId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    competitionId: row.competition_id,
    fixtureId: row.fixture_id,
    rosterId: row.roster_id,
    rulesetId: row.ruleset_id,
    status: parseEnumValue(MATCH_STATUS_VALUES, row.status, 'match status'),
    homeAway: row.home_away,
    ourScore: toNumber(row.our_score),
    opponentScore: toNumber(row.opponent_score),
    period: toNumber(row.period),
    streamVersion: toNumber(row.stream_version),
    recordVersion: toNumber(row.record_version),
    revision: toNumber(row.revision),
    result: parseEnumValue(MATCH_RESULT_VALUES, row.result, 'match result'),
    capApplied: parseEnumValue(CAP_KIND_VALUES, row.cap_applied, 'cap'),
    engineVersion: row.engine_version,
    supersedesMatchId: row.supersedes_match_id,
    reopenReason: row.reopen_reason,
    reopenedBy: row.reopened_by,
    reopenedAt: toNullableDate(row.reopened_at),
    createdBy: row.created_by,
    startedAt: toNullableDate(row.started_at),
    pausedAt: toNullableDate(row.paused_at),
    resumedAt: toNullableDate(row.resumed_at),
    halftimeAt: toNullableDate(row.halftime_at),
    completedAt: toNullableDate(row.completed_at),
    finalizedBy: row.finalized_by,
    finalizedAt: toNullableDate(row.finalized_at),
    abandonedAt: toNullableDate(row.abandoned_at),
    abandonReason: row.abandon_reason,
    notes: row.notes,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toMatchEvent(row: MatchEventRow): MatchEvent {
  return {
    eventId: row.id,
    matchId: row.match_id,
    teamId: row.team_id,
    sequence: toNumber(row.sequence),
    operationId: row.operation_id,
    requestHash: row.request_hash,
    eventType: parseEnumValue(
      MATCH_EVENT_TYPE_VALUES,
      row.event_type,
      'event type',
    ),
    scoringSide: parseNullableEnumValue(
      SCORING_SIDE_VALUES,
      row.scoring_side,
      'scoring side',
    ),
    points: toNullableNumber(row.points),
    ourScoreAfter: toNumber(row.our_score_after),
    opponentScoreAfter: toNumber(row.opponent_score_after),
    period: toNumber(row.period),
    scorerMembershipId: row.scorer_membership_id,
    assistMembershipId: row.assist_membership_id,
    voidsEventId: row.voids_event_id,
    voided: row.voided,
    voidReason: row.void_reason,
    recordedBy: row.recorded_by,
    occurredAt: toNullableDate(row.occurred_at),
    recordedAt: toDate(row.recorded_at),
  };
}

/**
 * Map a stored ruleset. Every cap stays nullable through the mapper: a missing
 * soft cap, hard cap, time cap, or halftime total means the rule DOES NOT APPLY
 * and is never coerced into a zero the scoring engine would act on.
 */
export function toMatchRuleset(row: MatchRulesetRow): MatchRuleset {
  return {
    rulesetId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    rulesetKey: row.ruleset_key,
    rulesetVersion: toNumber(row.ruleset_version),
    name: row.name,
    gameTo: toNumber(row.game_to),
    winBy: toNumber(row.win_by),
    hardCap: toNullableNumber(row.hard_cap),
    softCapMinutes: toNullableNumber(row.soft_cap_minutes),
    softCapPlus: toNullableNumber(row.soft_cap_plus),
    timeCapMinutes: toNullableNumber(row.time_cap_minutes),
    halftimeAt: toNullableNumber(row.halftime_at),
    timeoutsPerTeam: toNumber(row.timeouts_per_team),
    timeoutsPerPeriod: toNullableNumber(row.timeouts_per_period),
    periods: toNumber(row.periods),
    status: parseEnumValue(RULESET_STATUS_VALUES, row.status, 'ruleset status'),
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toMatchRevision(row: MatchRevisionRow): MatchRevision {
  return {
    revisionId: row.id,
    matchId: row.match_id,
    teamId: row.team_id,
    sequence: toNumber(row.sequence),
    revision: toNumber(row.revision),
    action: parseEnumValue(
      MATCH_REVISION_ACTION_VALUES,
      row.action,
      'revision action',
    ),
    reason: row.reason,
    fromStatus: parseEnumValue(
      MATCH_STATUS_VALUES,
      row.from_status,
      'match status',
    ),
    toStatus: parseEnumValue(
      MATCH_STATUS_VALUES,
      row.to_status,
      'match status',
    ),
    ourScoreBefore: toNumber(row.our_score_before),
    opponentScoreBefore: toNumber(row.opponent_score_before),
    ourScoreAfter: toNumber(row.our_score_after),
    opponentScoreAfter: toNumber(row.opponent_score_after),
    streamVersion: toNumber(row.stream_version),
    actorUserId: row.actor_user_id,
    createdAt: toDate(row.created_at),
  };
}

export function toMatchScope(row: MatchScopeRow): MatchScope {
  return {
    competitionId: row.competition_id,
    seasonId: row.season_id,
    homeAway: row.home_away,
  };
}
