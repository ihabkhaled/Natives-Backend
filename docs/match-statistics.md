# Match point lineups, possession events, and derived statistics (UN-504)

Scorekeeper terminology, the event dictionary, the stat formulas, and how a
correction works. Everything here is derived from source records — there is no
statistics table in the schema, by design.

## Scorekeeper terminology

| Term           | Meaning                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Point          | One passage of play from the pull to a goal. It is OPENED by a `point_started` fact and CLOSED by a `point_completed` fact. |
| Line           | The players on the field for a point. Recorded once, with the point start.                                                  |
| Puller         | The player who pulls to begin the point. At most one per line.                                                              |
| Starting line  | `offense` or `defense` — which line our team put on for the point. The only input hold/break needs.                         |
| Hold           | We started on offense and scored the point.                                                                                 |
| Break          | We started on defense and scored the point.                                                                                 |
| Opponent hold  | They started on offense (we started on defense) and they scored.                                                            |
| Opponent break | We started on offense and they scored.                                                                                      |
| Callahan       | A goal caught in our own end zone off an interception. Carries `assistState: none` — a MEASURED "there was no assist".      |
| Correction     | A compensating retraction. It never edits or deletes; it appends a fact that says an earlier fact no longer counts.         |

## Event dictionary (`match_play_events`)

Every row carries the client `operation_id` (unique per match), a `request_hash`
of the payload, a `sequence`, and the `point_number` it belongs to.

| `play_type`                            | Meaning                    | Required fields                                                                |
| -------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| `point_started`                        | A line took the field      | `starting_line`; the line is written to `match_point_lineups`                  |
| `point_completed`                      | The point ended            | `scoring_side`; `duration_seconds` optional (NULL = not measured)              |
| `pull`                                 | The pull                   | `primary_membership_id` optional                                               |
| `throw` / `completion`                 | A throw / a completed pass | `primary`/`secondary` optional                                                 |
| `goal`                                 | We scored                  | `primary` = scorer, `assist_state` + `secondary` = assist                      |
| `drop`                                 | Our receiver dropped it    | `primary` = the dropper                                                        |
| `throwaway`                            | Our thrower turfed it      | `primary` = the thrower                                                        |
| `block`                                | Our defensive block / D    | `primary` = the blocker                                                        |
| `stall`                                | Stall-out turnover         | `primary` optional                                                             |
| `call`                                 | A call was made            | `notes` optional                                                               |
| `turnover`                             | A turnover of another kind | `primary` optional                                                             |
| `substitution`                         | A mid-point substitution   | `primary` optional                                                             |
| `opponent_drop` / `opponent_throwaway` | A forced opponent error    | `primary` = our player who forced it (credited only when the ruleset approves) |
| `correction`                           | Retracts an earlier fact   | `corrects_play_id` + `correction_reason`                                       |

Grammar rules, enforced by the application and mirrored by CHECK constraints:

- A point may be opened only when none is open (`409 pointAlreadyOpen`).
- A completion or a possession fact requires an open point (`409 pointNotOpen`).
- A retracted fact cannot be retracted twice (`409 operationConflict`).
- The stream of a finalized or abandoned match is closed — refused by the
  application (`409 matchFinalized`) and by a database trigger.
- Recorded rows are never updated: an `ON UPDATE DO INSTEAD NOTHING` rule makes
  that true even for a direct SQL session.

## Stat formulas

Let EFFECTIVE = the facts that no `correction` retracted, excluding the
corrections themselves, ordered by `sequence`.

| Statistic                       | Formula                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Points played                   | Number of COMPLETED points whose line (attached to the point's `point_started`) contains the player                                               |
| Offence / defence points played | The same, split by the point's `starting_line`                                                                                                    |
| Goals                           | EFFECTIVE `goal` facts where the player is `primary`                                                                                              |
| Assists                         | EFFECTIVE `goal` facts with `assist_state = recorded` where the player is `secondary`                                                             |
| Callahans                       | EFFECTIVE `goal` facts where the player is `primary` and `callahan` is true                                                                       |
| Drops / Throwaways / Blocks     | EFFECTIVE `drop` / `throwaway` / `block` facts where the player is `primary`                                                                      |
| Opponent errors forced          | EFFECTIVE `opponent_drop` + `opponent_throwaway` facts where the player is `primary`, **only when the ruleset sets `opponent_error_attribution`** |
| Team holds / breaks             | Completed points classified by `starting_line` × `scoring_side`                                                                                   |
| Team goals for / against        | Completed points by `scoring_side`                                                                                                                |
| Team turnovers                  | EFFECTIVE `drop` + `throwaway` + `stall` + `turnover` facts                                                                                       |

The projection cites `rulesetKey`, `rulesetVersion`, and
`statsEngineVersion = match-statistics-v1` so any displayed number can be
re-derived and explained.

## Null is not zero

| Condition                                               | Result                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| No lineup was recorded for the match                    | `pointsPlayed`, `offencePointsPlayed`, `defencePointsPlayed` are `null` (`lineupsRecorded: false`)   |
| No possession fact was recorded                         | `goals`, `assists`, `callahans`, `drops`, `throwaways`, `blocks` are `null` (`playsRecorded: false`) |
| The ruleset does not approve opponent-error attribution | `opponentErrorsForced` and team `opponentErrors` are `null`                                          |
| The data exists and the player did nothing              | Every figure is a MEASURED `0`                                                                       |
| The point length was not timed                          | `durationSeconds` stays `null`, never `0`                                                            |

## Zero-contribution completeness

Every member of the match roster — including one a later revision withdrew — is
seeded into the projection before any fact is folded. A rostered player who never
took the field is present with `pointsPlayed: 0`, not omitted and not `null`.
Players who appear only in the stream are present too, flagged `rostered: false`.

## Corrections and rebuild determinism

A mistake is undone by APPENDING a `correction` that names the fact and the
reason. The original row stays on the stream, flagged `retracted` (derived from
the link, never stored on the original). The truth is then recorded as a new
fact.

Because the derivation folds only the EFFECTIVE set, and every counter is a
commutative sum over it, a stream that recorded a mistake and corrected it folds
to byte-identical statistics to a clean stream that only ever recorded the truth.
Point numbering reuses the number of a retracted point start, so the two streams
group into the same points. `test/match-statistics-golden.spec.ts` asserts that
equality directly, and
`test/database/match-lineups.integration.spec.ts` reproves it against a real
PostgreSQL instance.

`POST /teams/:teamId/matches/:matchId/statistics/rebuild` runs the SAME pure
derivation the read path runs and stores nothing; it exists to re-publish
`match.stats_projected.v1` and to record who asked for it.

## Permissions

| Operation                                                     | Permission         |
| ------------------------------------------------------------- | ------------------ |
| Open a point, record a fact, complete a point, correct a fact | `match.score`      |
| Read the point stream                                         | `match.read`       |
| Read or rebuild the statistics                                | `match.stats.read` |

## Domain events

`match.point_started.v1`, `match.point_completed.v1`,
`match.event_accepted.v1`, `match.event_corrected.v1`,
`match.stats_projected.v1` — all past-tense, versioned, and privacy-safe: they
carry line SIZES, play types, point numbers, and rule versions, never player
identities.
