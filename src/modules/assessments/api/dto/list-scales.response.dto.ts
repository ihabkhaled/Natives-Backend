import { ApiProperty } from '@core/openapi';

import { ScaleResponseDto } from './scale-response.dto';

export class ListScalesResponseDto {
  @ApiProperty({ type: [ScaleResponseDto] })
  declare readonly items: readonly ScaleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
