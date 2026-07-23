import { ApiProperty } from '@core/openapi';

import {
  AttendanceExcuseCategory,
  AttendanceSource,
  AttendanceState,
  AttendanceStatus,
} from '../../model/attendance.enums';

/**
 * One row of a member's own attendance history: a past (started, not cancelled)
 * session joined with the caller's record. `status` is null when nothing was
 * recorded (never coerced to ABSENT); `sheetState` is null before any sheet
 * exists and lets the client say "not finalized yet".
 */
export class AttendanceSelfHistoryEntryResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly startsAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly endsAt: Date;

  @ApiProperty()
  declare readonly sessionType: string;

  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  declare readonly status: AttendanceStatus | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly latenessMinutes: number | null;

  @ApiProperty({ enum: AttendanceExcuseCategory, nullable: true })
  declare readonly excuseCategory: AttendanceExcuseCategory | null;

  @ApiProperty({ enum: AttendanceSource, nullable: true })
  declare readonly source: AttendanceSource | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly recordedAt: Date | null;

  @ApiProperty({ enum: AttendanceState, nullable: true })
  declare readonly sheetState: AttendanceState | null;
}

/** A member's own paginated attendance history (newest first). */
export class AttendanceSelfHistoryResponseDto {
  @ApiProperty({ type: [AttendanceSelfHistoryEntryResponseDto] })
  declare readonly items: readonly AttendanceSelfHistoryEntryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
