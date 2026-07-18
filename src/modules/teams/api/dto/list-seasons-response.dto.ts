import { ApiProperty } from '@core/openapi';

import { SeasonResponseDto } from './season-response.dto';

export class ListSeasonsResponseDto {
  @ApiProperty({ type: [SeasonResponseDto] })
  declare readonly items: readonly SeasonResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
