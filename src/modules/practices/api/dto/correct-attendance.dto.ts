import { ApiProperty } from '@core/openapi';
import { IsString, MaxLength, MinLength } from '@core/validation';

import {
  CORRECTION_REASON_MAX_LENGTH,
  CORRECTION_REASON_MIN_LENGTH,
} from '../../model/attendance.constants';
import { AttendanceMarkDto } from './attendance-mark.dto';

/**
 * Body for a privileged correction of a finalized attendance record. A `reason` is
 * mandatory (recorded on the immutable revision and audited); `expectedVersion`
 * (inherited) guards a concurrent edit of the same record.
 */
export class CorrectAttendanceDto extends AttendanceMarkDto {
  @ApiProperty({
    minLength: CORRECTION_REASON_MIN_LENGTH,
    maxLength: CORRECTION_REASON_MAX_LENGTH,
  })
  @IsString()
  @MinLength(CORRECTION_REASON_MIN_LENGTH)
  @MaxLength(CORRECTION_REASON_MAX_LENGTH)
  declare readonly reason: string;
}
