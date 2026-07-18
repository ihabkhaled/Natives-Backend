import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/player-assessments.constants';

/**
 * Request body carrying only the optimistic-concurrency guard, shared by the
 * submit and publish transitions.
 */
export class OptimisticVersionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
