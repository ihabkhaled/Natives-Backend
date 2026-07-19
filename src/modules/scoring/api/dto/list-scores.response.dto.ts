import { ApiProperty } from '@core/openapi';

import { ScoreResponseDto } from './score-response.dto';

/** A bounded page of performance-score projections. */
export class ListScoresResponseDto {
  @ApiProperty({ type: [ScoreResponseDto] })
  declare readonly items: readonly ScoreResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
