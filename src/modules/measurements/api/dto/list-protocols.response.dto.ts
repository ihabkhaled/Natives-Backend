import { ApiProperty } from '@core/openapi';

import { ProtocolResponseDto } from './protocol-response.dto';

/** A bounded page of measurement protocols. */
export class ListProtocolsResponseDto {
  @ApiProperty({ type: [ProtocolResponseDto] })
  declare readonly items: readonly ProtocolResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
