import { ApiProperty } from '@core/openapi';

/**
 * The timeout budget of the current period, projected from the stream against
 * the match's versioned ruleset — never a stored counter that could drift.
 */
export class MatchTimeoutStateDto {
  @ApiProperty()
  declare readonly allowance: number;

  @ApiProperty()
  declare readonly usedByUs: number;

  @ApiProperty()
  declare readonly usedByThem: number;

  @ApiProperty()
  declare readonly remainingForUs: number;

  @ApiProperty()
  declare readonly remainingForThem: number;
}
