import { ApiProperty } from '@core/openapi';

import { ScoreCategory } from '../../model/scoring.enums';

/** The explained figure for one category component of a score. */
export class ScoreComponentResponseDto {
  @ApiProperty({ enum: ScoreCategory })
  declare readonly categoryKey: ScoreCategory;

  @ApiProperty()
  declare readonly weight: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly unrounded: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly display: number | null;

  @ApiProperty()
  declare readonly included: boolean;

  @ApiProperty()
  declare readonly assessedMetrics: number;

  @ApiProperty()
  declare readonly totalMetrics: number;

  @ApiProperty({ type: String, nullable: true })
  declare readonly excludedReason: string | null;
}
