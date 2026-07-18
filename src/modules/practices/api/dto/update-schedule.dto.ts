import { ApiProperty } from '@core/openapi';
import { IsEnum, IsInt, Min } from '@core/validation';

import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';
import { ScheduleStatus } from '../../model/practices.enums';
import { CreateScheduleDto } from './create-schedule.dto';

/**
 * Full replacement of a schedule template plus its archive status, guarded by the
 * caller's expected version for optimistic concurrency. Editing the template
 * never rewrites already-generated sessions.
 */
export class UpdateScheduleDto extends CreateScheduleDto {
  @ApiProperty({ enum: ScheduleStatus })
  @IsEnum(ScheduleStatus)
  declare readonly status: ScheduleStatus;

  @ApiProperty({ minimum: EXPECTED_VERSION_MIN })
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion: number;
}
