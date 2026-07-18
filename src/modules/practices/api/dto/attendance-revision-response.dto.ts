import { ApiProperty } from '@core/openapi';

import {
  AttendanceExcuseCategory,
  AttendanceSource,
  AttendanceStatus,
} from '../../model/attendance.enums';

/** One immutable entry in a record's append-only correction/change history. */
export class AttendanceRevisionResponseDto {
  @ApiProperty()
  declare readonly id: string;

  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  declare readonly fromStatus: AttendanceStatus | null;

  @ApiProperty({ enum: AttendanceStatus })
  declare readonly toStatus: AttendanceStatus;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly latenessMinutes: number | null;

  @ApiProperty({ enum: AttendanceExcuseCategory, nullable: true })
  declare readonly excuseCategory: AttendanceExcuseCategory | null;

  @ApiProperty({ enum: AttendanceSource })
  declare readonly source: AttendanceSource;

  @ApiProperty()
  declare readonly isCorrection: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly correctionReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly actorUserId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly occurredAt: Date;
}
