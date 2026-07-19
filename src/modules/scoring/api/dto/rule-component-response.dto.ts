import { ApiProperty } from '@core/openapi';

import { ScoreCategory } from '../../model/scoring.enums';

/** One weighted category component of a calculation rule. */
export class RuleComponentResponseDto {
  @ApiProperty({ enum: ScoreCategory })
  declare readonly categoryKey: ScoreCategory;

  @ApiProperty()
  declare readonly weight: number;

  @ApiProperty()
  declare readonly minSample: number;
}
