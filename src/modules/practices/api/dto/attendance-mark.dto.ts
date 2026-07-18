import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  ATTENDANCE_NOTE_MAX_LENGTH,
  EVIDENCE_REF_MAX_LENGTH,
  LATENESS_MINUTES_MAX,
  LATENESS_MINUTES_MIN,
} from '../../model/attendance.constants';
import {
  AttendanceExcuseCategory,
  AttendanceStatus,
} from '../../model/attendance.enums';
import { EXPECTED_VERSION_MIN } from '../../model/practices.constants';

/**
 * Shared mark fields for a participant's attendance. `latenessMinutes` is optional
 * and only meaningful for a present-late status (null-not-zero: never a measured 0
 * for an on-time member); an excuse category only accompanies excused/injured.
 * Cross-field consistency is enforced in the domain, not just here.
 */
export class AttendanceMarkDto {
  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  declare readonly status: AttendanceStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  declare readonly checkInAt?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  declare readonly checkOutAt?: string;

  @ApiPropertyOptional({
    minimum: LATENESS_MINUTES_MIN,
    maximum: LATENESS_MINUTES_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(LATENESS_MINUTES_MIN)
  @Max(LATENESS_MINUTES_MAX)
  declare readonly latenessMinutes?: number;

  @ApiPropertyOptional({ enum: AttendanceExcuseCategory })
  @IsOptional()
  @IsEnum(AttendanceExcuseCategory)
  declare readonly excuseCategory?: AttendanceExcuseCategory;

  @ApiPropertyOptional({ maxLength: ATTENDANCE_NOTE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(ATTENDANCE_NOTE_MAX_LENGTH)
  declare readonly note?: string;

  @ApiPropertyOptional({ maxLength: EVIDENCE_REF_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(EVIDENCE_REF_MAX_LENGTH)
  declare readonly evidenceRef?: string;

  @ApiPropertyOptional({ minimum: EXPECTED_VERSION_MIN })
  @IsOptional()
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion?: number;
}
