import { ApiProperty } from '@core/openapi';

import { VenueResponseDto } from './venue-response.dto';

export class ListVenuesResponseDto {
  @ApiProperty({ type: [VenueResponseDto] })
  declare readonly items: readonly VenueResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
