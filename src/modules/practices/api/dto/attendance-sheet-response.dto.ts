import { ApiProperty } from '@core/openapi';

import { AttendanceState } from '../../model/attendance.enums';
import { PracticeRosterEntryResponseDto } from './roster-entry-response.dto';

/**
 * The attendance roster + sheet finalization state for a session (the prefill /
 * marking view). `state` is `open` even before any row exists, so the client always
 * has a lifecycle state to render.
 */
export class AttendanceSheetResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty({ enum: AttendanceState })
  declare readonly state: AttendanceState;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly finalizedAt: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly version: number | null;

  @ApiProperty({ type: [PracticeRosterEntryResponseDto] })
  declare readonly items: readonly PracticeRosterEntryResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
