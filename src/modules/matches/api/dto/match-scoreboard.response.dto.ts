import { ApiProperty } from '@core/openapi';

import { CapKind, MatchResult, MatchStatus } from '../../model/matches.enums';
import { MatchTimeoutStateDto } from './match-timeout-state.dto';

/**
 * The privileged scorekeeper view. Nothing here is a stored total: the effective
 * target, the cap that decided it, the completion signal, and the timeout budget
 * are re-derived every read from the versioned ruleset and the event stream, and
 * the projection cites `rulesetKey`/`rulesetVersion`/`engineVersion` so any
 * displayed number can be explained rather than merely trusted.
 */
export class MatchScoreboardResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly matchId: string;

  @ApiProperty({ enum: MatchStatus })
  declare readonly status: MatchStatus;

  @ApiProperty()
  declare readonly ourScore: number;

  @ApiProperty()
  declare readonly opponentScore: number;

  @ApiProperty()
  declare readonly period: number;

  @ApiProperty()
  declare readonly streamVersion: number;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ enum: MatchResult })
  declare readonly result: MatchResult;

  @ApiProperty()
  declare readonly rulesetKey: string;

  @ApiProperty()
  declare readonly rulesetVersion: number;

  @ApiProperty()
  declare readonly engineVersion: string;

  @ApiProperty()
  declare readonly target: number;

  @ApiProperty({ enum: CapKind })
  declare readonly capApplied: CapKind;

  @ApiProperty()
  declare readonly complete: boolean;

  @ApiProperty()
  declare readonly halftimeReached: boolean;

  @ApiProperty({ type: MatchTimeoutStateDto })
  declare readonly timeouts: MatchTimeoutStateDto;

  @ApiProperty()
  declare readonly scoringOpen: boolean;
}
