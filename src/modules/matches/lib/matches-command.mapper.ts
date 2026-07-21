import {
  DEFAULT_POINT_VALUE,
  PERIODS_MIN,
  RECORD_VERSION_MIN,
  TIMEOUTS_MIN,
  WIN_BY_MIN,
} from '../model/matches.constants';
import { AssistState } from '../model/matches.enums';
import type {
  CompletePointContent,
  CompletePointContentInput,
  CorrectionContent,
  CorrectionContentInput,
  MatchContent,
  MatchContentInput,
  MatchListFilter,
  MatchListFilterInput,
  MatchRulesetContent,
  MatchRulesetContentInput,
  PlayContent,
  PlayContentInput,
  PointContent,
  PointContentInput,
  StartPointContent,
  StartPointContentInput,
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
    opponentErrorAttribution: orDefault(input.opponentErrorAttribution, false),
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

export function toStartPointContent(
  input: StartPointContentInput,
): StartPointContent {
  return {
    operationId: input.operationId,
    startingLine: input.startingLine,
    lineMembershipIds: input.lineMembershipIds,
    pullerMembershipId: orNull(input.pullerMembershipId),
    occurredAt: orNull(input.occurredAt),
    notes: orNull(input.notes),
  };
}

/**
 * A point completion. `durationSeconds` collapses onto NULL when it was not
 * supplied — an unmeasured point length is never recorded as zero seconds.
 */
export function toCompletePointContent(
  input: CompletePointContentInput,
): CompletePointContent {
  return {
    operationId: input.operationId,
    scoringSide: input.scoringSide,
    durationSeconds: orNull(input.durationSeconds),
    occurredAt: orNull(input.occurredAt),
    notes: orNull(input.notes),
  };
}

/**
 * One possession fact. An unspecified assist is `unknown` — missing data that is
 * never inferred — while `none` is the deliberate, MEASURED "there was no
 * assist" a Callahan or an unassisted goal carries.
 */
export function toPlayContent(input: PlayContentInput): PlayContent {
  return {
    operationId: input.operationId,
    playType: input.playType,
    primaryMembershipId: orNull(input.primaryMembershipId),
    secondaryMembershipId: orNull(input.secondaryMembershipId),
    assistState: orDefault(input.assistState, AssistState.Unknown),
    callahan: orDefault(input.callahan, false),
    occurredAt: orNull(input.occurredAt),
    notes: orNull(input.notes),
  };
}

export function toCorrectionContent(
  input: CorrectionContentInput,
): CorrectionContent {
  return {
    operationId: input.operationId,
    playId: input.playId,
    reason: input.reason,
  };
}

/** The optimistic version a caller must present, defaulted to the first. */
export function toExpectedRecordVersion(value: number | undefined): number {
  return value ?? RECORD_VERSION_MIN;
}
