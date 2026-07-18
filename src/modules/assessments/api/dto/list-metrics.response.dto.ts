import { ApiProperty } from '@core/openapi';

import { MetricResponseDto } from './metric-response.dto';

export class ListMetricsResponseDto {
  @ApiProperty({ type: [MetricResponseDto] })
  declare readonly items: readonly MetricResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
