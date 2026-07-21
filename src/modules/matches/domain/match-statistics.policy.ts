import {
  MATCH_STATS_ENGINE_VERSION,
  ZERO_COUNT,
} from '../model/matches.constants';
import {
  AssistState,
  MatchPlayType,
  PointOutcome,
  PointStartingLine,
  ScoringSide,
} from '../model/matches.enums';
import type {
  MatchPlayEvent,
  MatchPointLineupEntry,
  MatchRosterMember,
  MatchStatistics,
  MatchStatisticsSource,
  PlayerCounters,
  PlayerMatchStatistics,
  ResolvedMatchPoint,
  TeamMatchStatistics,
} from '../model/matches.types';
import {
  classifyPoint,
  isEffectivePlay,
  isOpponentErrorPlay,
  isPossessionPlay,
  isTurnoverPlay,
} from './match-point.state-machine';

/**
 * The pure derivation engine (UN-504). Statistics are a PROJECTION: this
 * function folds the append-only point stream, the lineups attached to it, the
 * match roster, and the versioned ruleset into per-player and per-team figures.
 * Nothing here reads a stored total, and nothing it returns is editable.
 *
 * Two guarantees the golden tests pin down:
 *
 *  - REBUILD DETERMINISM. Only facts that no correction retracted are folded,
 *    and every counter is a commutative sum over that set. A stream that
 *    recorded a mistake, retracted it, and re-recorded the truth therefore
 *    produces byte-identical statistics to a clean stream that only ever
 *    recorded the truth — sequence numbers differ, results do not.
 *  - NULL IS NOT ZERO. A figure is `null` when it was NOT MEASURED (no lineups
 *    recorded, no possession facts recorded, or opponent-error attribution not
 *    approved by the ruleset) and a number when it was — so a rostered player
 *    who did nothing reports a MEASURED `0` and is never omitted from the
 *    report, while a match nobody tracked reports `null` and is never read as a
 *    row of zeroes.
 */
export function deriveMatchStatistics(
  source: MatchStatisticsSource,
): MatchStatistics {
  const plays = orderPlays(source.plays);
  const points = resolveCompletedPoints(plays);
  const lineups = attachedLineups(source.lineups, plays);
  const counters = new Map<string, PlayerCounters>();
  registerRoster(counters, source.roster);
  applyLineups(counters, points, lineups);
  applyPlays(counters, plays);
  return assemble(source, plays, points, lineups, counters);
}

/** The facts that still count, in recorded order. */
export function orderPlays(
  plays: readonly MatchPlayEvent[],
): readonly MatchPlayEvent[] {
  return [...plays]
    .filter(play => isEffectivePlay(play))
    .sort((left, right) => left.sequence - right.sequence);
}

/**
 * Every point that both started and completed, classified as hold or break. A
 * point whose start was retracted, or whose start or completion is missing the
 * fact the classification needs, is left out rather than guessed.
 */
export function resolveCompletedPoints(
  plays: readonly MatchPlayEvent[],
): readonly ResolvedMatchPoint[] {
  const starts = new Map<number, MatchPlayEvent>();
  const resolved: ResolvedMatchPoint[] = [];
  for (const play of plays) {
    if (play.playType === MatchPlayType.PointStarted) {
      starts.set(play.pointNumber, play);
    }
    if (play.playType === MatchPlayType.PointCompleted) {
      appendResolvedPoint(resolved, starts.get(play.pointNumber), play);
    }
  }
  return resolved;
}

function appendResolvedPoint(
  target: ResolvedMatchPoint[],
  start: MatchPlayEvent | undefined,
  completion: MatchPlayEvent,
): void {
  if (start === undefined) {
    return;
  }
  appendClassifiedPoint(target, start, completion);
}

function appendClassifiedPoint(
  target: ResolvedMatchPoint[],
  start: MatchPlayEvent,
  completion: MatchPlayEvent,
): void {
  const startingLine = start.startingLine;
  const scoringSide = completion.scoringSide;
  if (startingLine === null || scoringSide === null) {
    return;
  }
  target.push({
    pointNumber: completion.pointNumber,
    startingLine,
    scoringSide,
    outcome: classifyPoint(startingLine, scoringSide),
    playId: start.playId,
  });
}

/** Only lineups attached to a point-start that still counts are read. */
function attachedLineups(
  lineups: readonly MatchPointLineupEntry[],
  plays: readonly MatchPlayEvent[],
): readonly MatchPointLineupEntry[] {
  const startIds = new Set(
    plays
      .filter(play => play.playType === MatchPlayType.PointStarted)
      .map(play => play.playId),
  );
  return lineups.filter(entry => startIds.has(entry.playId));
}

/**
 * Seed every rostered player at a MEASURED zero before any fact is folded. This
 * is the zero-contribution completeness rule: a player on the match roster is
 * present in the report whether or not the stream ever mentions them.
 */
function registerRoster(
  counters: Map<string, PlayerCounters>,
  roster: readonly MatchRosterMember[],
): void {
  for (const member of roster) {
    ensureCounters(counters, member.membershipId);
  }
}

function ensureCounters(
  counters: Map<string, PlayerCounters>,
  membershipId: string,
): PlayerCounters {
  const existing = counters.get(membershipId);
  if (existing !== undefined) {
    return existing;
  }
  const created = emptyCounters();
  counters.set(membershipId, created);
  return created;
}

function emptyCounters(): PlayerCounters {
  return {
    pointsPlayed: ZERO_COUNT,
    offencePointsPlayed: ZERO_COUNT,
    defencePointsPlayed: ZERO_COUNT,
    goals: ZERO_COUNT,
    assists: ZERO_COUNT,
    callahans: ZERO_COUNT,
    drops: ZERO_COUNT,
    throwaways: ZERO_COUNT,
    blocks: ZERO_COUNT,
    opponentErrorsForced: ZERO_COUNT,
  };
}

/** Points played come from LINEUP membership of COMPLETED points only. */
function applyLineups(
  counters: Map<string, PlayerCounters>,
  points: readonly ResolvedMatchPoint[],
  lineups: readonly MatchPointLineupEntry[],
): void {
  for (const point of points) {
    creditLine(
      counters,
      point,
      lineups.filter(entry => entry.playId === point.playId),
    );
  }
}

function creditLine(
  counters: Map<string, PlayerCounters>,
  point: ResolvedMatchPoint,
  line: readonly MatchPointLineupEntry[],
): void {
  for (const entry of line) {
    creditPointPlayed(
      ensureCounters(counters, entry.membershipId),
      point.startingLine,
    );
  }
}

function creditPointPlayed(
  counters: PlayerCounters,
  startingLine: PointStartingLine,
): void {
  counters.pointsPlayed += 1;
  if (startingLine === PointStartingLine.Offense) {
    counters.offencePointsPlayed += 1;
    return;
  }
  counters.defencePointsPlayed += 1;
}

function applyPlays(
  counters: Map<string, PlayerCounters>,
  plays: readonly MatchPlayEvent[],
): void {
  for (const play of plays) {
    applyPrimary(counters, play);
    applyAssist(counters, play);
  }
}

function applyPrimary(
  counters: Map<string, PlayerCounters>,
  play: MatchPlayEvent,
): void {
  const membershipId = play.primaryMembershipId;
  if (membershipId === null) {
    return;
  }
  creditPrimary(ensureCounters(counters, membershipId), play);
}

function creditPrimary(counters: PlayerCounters, play: MatchPlayEvent): void {
  if (play.playType === MatchPlayType.Goal) {
    creditGoal(counters, play);
    return;
  }
  if (play.playType === MatchPlayType.Drop) {
    counters.drops += 1;
    return;
  }
  if (play.playType === MatchPlayType.Throwaway) {
    counters.throwaways += 1;
    return;
  }
  if (play.playType === MatchPlayType.Block) {
    counters.blocks += 1;
    return;
  }
  if (isOpponentErrorPlay(play.playType)) {
    counters.opponentErrorsForced += 1;
  }
}

function creditGoal(counters: PlayerCounters, play: MatchPlayEvent): void {
  counters.goals += 1;
  if (play.callahan) {
    counters.callahans += 1;
  }
}

/**
 * An assist is credited only when the stream RECORDED one. A Callahan or an
 * explicitly unassisted goal carries `none` and credits nobody; an unknown
 * assist carries `unknown` and is never invented.
 */
function applyAssist(
  counters: Map<string, PlayerCounters>,
  play: MatchPlayEvent,
): void {
  const assistId = play.secondaryMembershipId;
  if (
    play.playType !== MatchPlayType.Goal ||
    play.assistState !== AssistState.Recorded ||
    assistId === null
  ) {
    return;
  }
  ensureCounters(counters, assistId).assists += 1;
}

function assemble(
  source: MatchStatisticsSource,
  plays: readonly MatchPlayEvent[],
  points: readonly ResolvedMatchPoint[],
  lineups: readonly MatchPointLineupEntry[],
  counters: ReadonlyMap<string, PlayerCounters>,
): MatchStatistics {
  const lineupsRecorded = lineups.length > 0;
  const playsRecorded = plays.some(play => isPossessionPlay(play.playType));
  const errorsMeasured = playsRecorded && source.opponentErrorAttribution;
  return {
    matchId: source.matchId,
    teamId: source.teamId,
    rulesetKey: source.rulesetKey,
    rulesetVersion: source.rulesetVersion,
    statsEngineVersion: MATCH_STATS_ENGINE_VERSION,
    lineupsRecorded,
    playsRecorded,
    opponentErrorAttribution: source.opponentErrorAttribution,
    team: buildTeamStatistics(plays, points, playsRecorded, errorsMeasured),
    players: buildPlayers(source.roster, counters, {
      lineupsRecorded,
      playsRecorded,
      errorsMeasured,
    }),
  };
}

function buildTeamStatistics(
  plays: readonly MatchPlayEvent[],
  points: readonly ResolvedMatchPoint[],
  playsRecorded: boolean,
  errorsMeasured: boolean,
): TeamMatchStatistics {
  return {
    pointsStarted: countType(plays, MatchPlayType.PointStarted),
    pointsCompleted: points.length,
    holds: countOutcome(points, PointOutcome.Hold),
    breaks: countOutcome(points, PointOutcome.Break),
    opponentHolds: countOutcome(points, PointOutcome.OpponentHold),
    opponentBreaks: countOutcome(points, PointOutcome.OpponentBreak),
    goalsFor: countSide(points, ScoringSide.Us),
    goalsAgainst: countSide(points, ScoringSide.Them),
    drops: measured(playsRecorded, countType(plays, MatchPlayType.Drop)),
    throwaways: measured(
      playsRecorded,
      countType(plays, MatchPlayType.Throwaway),
    ),
    blocks: measured(playsRecorded, countType(plays, MatchPlayType.Block)),
    turnovers: measured(playsRecorded, countTurnovers(plays)),
    opponentErrors: measured(errorsMeasured, countOpponentErrors(plays)),
  };
}

function buildPlayers(
  roster: readonly MatchRosterMember[],
  counters: ReadonlyMap<string, PlayerCounters>,
  measurement: {
    readonly lineupsRecorded: boolean;
    readonly playsRecorded: boolean;
    readonly errorsMeasured: boolean;
  },
): readonly PlayerMatchStatistics[] {
  const rostered = new Map(
    roster.map(member => [member.membershipId, member.rosterEntryId]),
  );
  return [...counters.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : 1))
    .map(entry => buildPlayer(entry[0], entry[1], rostered, measurement));
}

function buildPlayer(
  membershipId: string,
  counters: PlayerCounters,
  rostered: ReadonlyMap<string, string | null>,
  measurement: {
    readonly lineupsRecorded: boolean;
    readonly playsRecorded: boolean;
    readonly errorsMeasured: boolean;
  },
): PlayerMatchStatistics {
  const lineups = measurement.lineupsRecorded;
  const tracked = measurement.playsRecorded;
  return {
    membershipId,
    rosterEntryId: rostered.get(membershipId) ?? null,
    rostered: rostered.has(membershipId),
    pointsPlayed: measured(lineups, counters.pointsPlayed),
    offencePointsPlayed: measured(lineups, counters.offencePointsPlayed),
    defencePointsPlayed: measured(lineups, counters.defencePointsPlayed),
    goals: measured(tracked, counters.goals),
    assists: measured(tracked, counters.assists),
    callahans: measured(tracked, counters.callahans),
    drops: measured(tracked, counters.drops),
    throwaways: measured(tracked, counters.throwaways),
    blocks: measured(tracked, counters.blocks),
    opponentErrorsForced: measured(
      measurement.errorsMeasured,
      counters.opponentErrorsForced,
    ),
  };
}

/**
 * `null` means NOT MEASURED and a number means measured — including a real
 * zero. The two are never collapsed into each other.
 */
function measured(isMeasured: boolean, value: number): number | null {
  return isMeasured ? value : null;
}

function countType(
  plays: readonly MatchPlayEvent[],
  playType: MatchPlayType,
): number {
  return plays.filter(play => play.playType === playType).length;
}

function countTurnovers(plays: readonly MatchPlayEvent[]): number {
  return plays.filter(play => isTurnoverPlay(play.playType)).length;
}

function countOpponentErrors(plays: readonly MatchPlayEvent[]): number {
  return plays.filter(play => isOpponentErrorPlay(play.playType)).length;
}

function countOutcome(
  points: readonly ResolvedMatchPoint[],
  outcome: PointOutcome,
): number {
  return points.filter(point => point.outcome === outcome).length;
}

function countSide(
  points: readonly ResolvedMatchPoint[],
  side: ScoringSide,
): number {
  return points.filter(point => point.scoringSide === side).length;
}
