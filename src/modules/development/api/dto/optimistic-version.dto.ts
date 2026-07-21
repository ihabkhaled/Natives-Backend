import { ApiProperty } from '@core/openapi';
import { IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/development.constants';

/** Request body carrying only the optimistic-concurrency guard. */
export class DevelopmentOptimisticVersionDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
