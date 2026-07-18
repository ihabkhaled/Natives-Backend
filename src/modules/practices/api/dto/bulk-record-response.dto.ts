import { ApiProperty } from '@core/openapi';

import { AttendanceResponseDto } from './attendance-response.dto';

/** The result of an atomic bulk record: every applied row plus the applied count. */
export class BulkRecordResponseDto {
  @ApiProperty({ type: [AttendanceResponseDto] })
  declare readonly items: readonly AttendanceResponseDto[];

  @ApiProperty()
  declare readonly recorded: number;
}
