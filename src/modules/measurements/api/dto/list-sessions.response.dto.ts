import { ApiProperty } from '@core/openapi';

import { MeasurementSessionResponseDto } from './session-response.dto';

/** A bounded page of measurement sessions. */
export class MeasurementListSessionsResponseDto {
  @ApiProperty({ type: [MeasurementSessionResponseDto] })
  declare readonly items: readonly MeasurementSessionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
