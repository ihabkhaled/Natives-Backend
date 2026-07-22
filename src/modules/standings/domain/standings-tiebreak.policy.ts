import { StandingTieBreak } from '../model/standings.enums';
import type {
  CompetitionStanding,
  StandingsRuleVersion,
} from '../model/standings.types';

/**
 * Deterministic standings ordering (UN-506).
 *
 * The ordering is driven entirely by the rule version's own `tieBreakOrder`, so
 * two runs of the same version always produce the same table and a NEWER version
 * never re-orders an older one. Every comparison ends in a stable identity
 * tie-break, so equal rows never swap places between two reads.
 *
 * A null spirit score sorts LAST rather than as zero: not scored is not the same
 * as scored badly.
 */
export function orderStandings(
  rows: readonly CompetitionStanding[],
  rule: StandingsRuleVersion,
): readonly CompetitionStanding[] {
  return [...rows].sort((left, right) => compareStandings(left, right, rule));
}

export function compareStandings(
  left: CompetitionStanding,
  right: CompetitionStanding,
  rule: StandingsRuleVersion,
): number {
  for (const criterion of rule.tieBreakOrder) {
    const verdict = compareBy(criterion, left, right);
    if (verdict !== 0) {
      return verdict;
    }
  }
  return left.standingId.localeCompare(right.standingId);
}

export function compareBy(
  criterion: StandingTieBreak,
  left: CompetitionStanding,
  right: CompetitionStanding,
): number {
  if (criterion === StandingTieBreak.Alphabetical) {
    return entrantKey(left).localeCompare(entrantKey(right));
  }
  if (criterion === StandingTieBreak.Spirit) {
    return compareSpirit(left.spiritScore, right.spiritScore);
  }
  return descending(metricOf(criterion, left), metricOf(criterion, right));
}

/** The numeric value of a comparable criterion for one row. */
export function metricOf(
  criterion: StandingTieBreak,
  row: CompetitionStanding,
): number {
  if (criterion === StandingTieBreak.Wins) {
    return row.wins;
  }
  if (criterion === StandingTieBreak.PointDifference) {
    return row.pointsFor - row.pointsAgainst;
  }
  if (criterion === StandingTieBreak.PointsFor) {
    return row.pointsFor;
  }
  if (criterion === StandingTieBreak.PointsAgainst) {
    return -row.pointsAgainst;
  }
  return row.standingPoints;
}

/** A null spirit score is never treated as zero; it simply sorts last. */
export function compareSpirit(
  left: number | null,
  right: number | null,
): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right - left;
}

function descending(left: number, right: number): number {
  return right - left;
}

function entrantKey(row: CompetitionStanding): string {
  return row.opponentId ?? row.teamId;
}
