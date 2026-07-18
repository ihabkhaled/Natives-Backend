import { ApiProperty } from '@core/openapi';

import { AttendanceRevisionResponseDto } from './attendance-revision-response.dto';

/** A member's attendance revision history for a session, oldest-first. */
export class AttendanceHistoryResponseDto {
  @ApiProperty({ type: [AttendanceRevisionResponseDto] })
  declare readonly items: readonly AttendanceRevisionResponseDto[];
}
