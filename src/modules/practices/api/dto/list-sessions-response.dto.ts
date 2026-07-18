import { ApiProperty } from '@core/openapi';

import { SessionResponseDto } from './session-response.dto';

export class ListSessionsResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  declare readonly items: readonly SessionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
