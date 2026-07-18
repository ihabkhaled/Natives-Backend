import { ApiProperty } from '@core/openapi';

import {
  AttendanceExcuseCategory,
  AttendanceSource,
  AttendanceStatus,
} from '../../model/attendance.enums';

/**
 * A member's attendance for a session. When nothing has been recorded, `status` is
 * null and the metadata fields are null (absence modelled explicitly, never coerced
 * to ABSENT or zero).
 */
export class AttendanceResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  declare readonly status: AttendanceStatus | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly checkInAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly checkOutAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly latenessMinutes: number | null;

  @ApiProperty({ enum: AttendanceExcuseCategory, nullable: true })
  declare readonly excuseCategory: AttendanceExcuseCategory | null;

  @ApiProperty({ enum: AttendanceSource, nullable: true })
  declare readonly source: AttendanceSource | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly recordedAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly version: number | null;
}
