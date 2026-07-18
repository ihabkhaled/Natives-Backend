import { ApiProperty } from '@core/openapi';

import { ScheduleResponseDto } from './schedule-response.dto';

export class ListSchedulesResponseDto {
  @ApiProperty({ type: [ScheduleResponseDto] })
  declare readonly items: readonly ScheduleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
