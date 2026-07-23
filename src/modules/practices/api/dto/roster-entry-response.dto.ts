import { ApiProperty } from '@core/openapi';

import {
  AttendanceExcuseCategory,
  AttendanceSource,
  AttendanceStatus,
} from '../../model/attendance.enums';
import { RsvpStatus } from '../../model/rsvp.enums';

/**
 * One roster row: an active member and their attendance. Unmarked members appear
 * with a null status (null-not-zero) so every rostered participant is present for
 * prefill and zero-contribution completeness. `displayName` resolves through the
 * member-profile → user fallback chain and `rsvpStatus` carries the member's
 * RSVP answer for this session (both null when unavailable). Notes and reasons
 * are never included.
 */
export class PracticeRosterEntryResponseDto {
  @ApiProperty()
  declare readonly membershipId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly userId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly displayName: string | null;

  @ApiProperty({ enum: RsvpStatus, nullable: true })
  declare readonly rsvpStatus: RsvpStatus | null;

  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  declare readonly status: AttendanceStatus | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly checkInAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly latenessMinutes: number | null;

  @ApiProperty({ enum: AttendanceExcuseCategory, nullable: true })
  declare readonly excuseCategory: AttendanceExcuseCategory | null;

  @ApiProperty({ enum: AttendanceSource, nullable: true })
  declare readonly source: AttendanceSource | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly version: number | null;
}
