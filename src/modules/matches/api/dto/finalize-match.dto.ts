import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Min } from '@core/validation';

import { RECORD_VERSION_MIN, SCORE_MIN } from '../../model/matches.constants';

/**
 * Request body to publish the authoritative result of a completed match.
 *
 * The score is NOT taken from this request — it is the projection of the event
 * stream. A caller may optionally ASSERT the score they believe is final; if it
 * disagrees with the stream the request is refused as a conflict, so two devices
 * can never silently merge into a third, invented final score.
 */
export class FinalizeMatchDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ minimum: SCORE_MIN, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(SCORE_MIN)
  readonly ourScore?: number | null;

  @ApiPropertyOptional({ minimum: SCORE_MIN, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(SCORE_MIN)
  readonly opponentScore?: number | null;
}
