import { ApiProperty } from '@core/openapi';

import { AvailabilityResponseDto } from './availability-response.dto';

/** A bounded page of squad availability declarations. */
export class ListAvailabilityResponseDto {
  @ApiProperty({ type: [AvailabilityResponseDto] })
  declare readonly items: readonly AvailabilityResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
