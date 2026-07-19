import { ApiProperty } from '@core/openapi';

import { ScoreResponseDto } from './score-response.dto';

/** A member's own performance-score projections (one per rule family). */
export class ScoreListResponseDto {
  @ApiProperty({ type: [ScoreResponseDto] })
  declare readonly items: readonly ScoreResponseDto[];
}
