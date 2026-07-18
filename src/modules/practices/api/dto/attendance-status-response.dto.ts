import { ApiProperty } from '@core/openapi';

import { AttendanceState } from '../../model/attendance.enums';

/** The sheet lifecycle state returned by finalize (and echoed after correction). */
export class AttendanceStatusResponseDto {
  @ApiProperty()
  declare readonly sessionId: string;

  @ApiProperty({ enum: AttendanceState })
  declare readonly state: AttendanceState;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly finalizedAt: Date | null;

  @ApiProperty()
  declare readonly recordCount: number;

  @ApiProperty()
  declare readonly version: number;
}
