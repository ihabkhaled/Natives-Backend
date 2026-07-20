import {
  DEFAULT_POINT_VALUE,
  PERIODS_MIN,
  RECORD_VERSION_MIN,
  TIMEOUTS_MIN,
  WIN_BY_MIN,
} from '../model/matches.constants';
import type {
  MatchContent,
  MatchContentInput,
  MatchListFilter,
  MatchListFilterInput,
  MatchRulesetContent,
  MatchRulesetContentInput,
  PointContent,
  PointContentInput,
  TimeoutContent,
  TimeoutContentInput,
} from '../model/matches.types';
import { orDefault, orNull } from './matches.helpers';

/**
 * Translate validated transport shapes into domain commands. Optional transport
 * fields collapse onto explicit nulls (a cap that was not supplied DOES NOT
 * APPLY — it never becomes a zero the engine acts on), and the few fields that
 * carry a documented default get it here rather than in a service.
 */

export function toMatchContent(input: MatchContentInput): MatchContent {
  return {
    fixtureId: input.fixtureId,
    rosterId: orNull(input.rosterId),
    rulesetId: orNull(input.rulesetId),
    notes: orNull(input.notes),
  };
}

export function toMatchRulesetContent(
  input: MatchRulesetContentInput,
): MatchRulesetContent {
  return {
    rulesetKey: input.rulesetKey,
    seasonId: orNull(input.seasonId),
    name: input.name,
    gameTo: input.gameTo,
    winBy: orDefault(input.winBy, WIN_BY_MIN),
    hardCap: orNull(input.hardCap),
    softCapMinutes: orNull(input.softCapMinutes),
    softCapPlus: orNull(input.softCapPlus),
    timeCapMinutes: orNull(input.timeCapMinutes),
    halftimeAt: orNull(input.halftimeAt),
    timeoutsPerTeam: orDefault(input.timeoutsPerTeam, TIMEOUTS_MIN),
    timeoutsPerPeriod: orNull(input.timeoutsPerPeriod),
    periods: orDefault(input.periods, PERIODS_MIN),
    notes: orNull(input.notes),
  };
}

export function toPointContent(input: PointContentInput): PointContent {
  return {
    operationId: input.operationId,
    scoringSide: input.scoringSide,
    points: orDefault(input.points, DEFAULT_POINT_VALUE),
    scorerMembershipId: orNull(input.scorerMembershipId),
    assistMembershipId: orNull(input.assistMembershipId),
    occurredAt: orNull(input.occurredAt),
    expectedStreamVersion: orNull(input.expectedStreamVersion),
  };
}

export function toTimeoutContent(input: TimeoutContentInput): TimeoutContent {
  return {
    operationId: input.operationId,
    scoringSide: input.scoringSide,
    occurredAt: orNull(input.occurredAt),
  };
}

export function toMatchListFilter(
  input: MatchListFilterInput,
): MatchListFilter {
  return {
    competitionId: orNull(input.competitionId),
    fixtureId: orNull(input.fixtureId),
    status: orNull(input.status),
  };
}

/** The optimistic version a caller must present, defaulted to the first. */
export function toExpectedRecordVersion(value: number | undefined): number {
  return value ?? RECORD_VERSION_MIN;
}
