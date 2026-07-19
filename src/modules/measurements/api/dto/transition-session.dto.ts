import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { RECORD_VERSION_MIN } from '../../model/measurements.constants';
import { SessionTransition } from '../../model/measurements.enums';

/** Request body to move a measurement session through its lifecycle. */
export class TransitionSessionDto {
  @ApiProperty({ enum: SessionTransition })
  @IsEnum(SessionTransition)
  declare readonly transition: SessionTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}
