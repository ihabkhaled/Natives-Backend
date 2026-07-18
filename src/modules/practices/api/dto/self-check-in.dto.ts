import { ApiPropertyOptional } from '@core/openapi';
import { IsOptional, IsString, MaxLength } from '@core/validation';

import { ATTENDANCE_NOTE_MAX_LENGTH } from '../../model/attendance.constants';

/**
 * Body for a member self check-in. The status and lateness are DERIVED from the
 * clock server-side (never trusted from the client); only an optional note is
 * accepted here.
 */
export class SelfCheckInDto {
  @ApiPropertyOptional({ maxLength: ATTENDANCE_NOTE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(ATTENDANCE_NOTE_MAX_LENGTH)
  declare readonly note?: string;
}
