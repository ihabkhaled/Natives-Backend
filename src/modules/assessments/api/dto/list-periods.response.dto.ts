import { ApiProperty } from '@core/openapi';

import { PeriodResponseDto } from './period-response.dto';

export class ListPeriodsResponseDto {
  @ApiProperty({ type: [PeriodResponseDto] })
  declare readonly items: readonly PeriodResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
