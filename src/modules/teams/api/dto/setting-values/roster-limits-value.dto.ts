import { ApiProperty, ApiPropertyOptional } from '@core/openapi';

import {
  MATCH_SQUAD_MIN_FLOOR,
  ROSTER_SIZE_MAX,
  SETTING_CODE_PATTERN,
} from '../../../model/setting-values.constants';

/**
 * OpenAPI mirror of `RosterLimitsValue` (domain contract of record:
 * `domain/setting-value.policy.ts`). `perPosition[].positionKey` must reference
 * an ACTIVE `position` reference-catalog entry (P2 cross-reference).
 */
export class RosterBoundDto {
  @ApiPropertyOptional({ minimum: 1 })
  declare readonly min?: number;

  @ApiProperty({ minimum: 1, maximum: ROSTER_SIZE_MAX })
  declare readonly max: number;
}

export class PositionLimitDto {
  @ApiProperty({ pattern: SETTING_CODE_PATTERN.source })
  declare readonly positionKey: string;

  @ApiProperty({ minimum: 1 })
  declare readonly max: number;
}

export class RosterLimitsValueDto {
  @ApiProperty({ type: RosterBoundDto })
  declare readonly roster: RosterBoundDto;

  @ApiPropertyOptional({
    type: RosterBoundDto,
    description: `max must be ≥ ${String(MATCH_SQUAD_MIN_FLOOR)} (a full line) and ≤ roster.max.`,
  })
  declare readonly matchSquad?: RosterBoundDto;

  @ApiPropertyOptional({ type: [PositionLimitDto] })
  declare readonly perPosition?: readonly PositionLimitDto[];
}
