import { ApiProperty } from '@core/openapi';

import { PracticeSessionResponseDto } from './session-response.dto';

export class ListSessionsResponseDto {
  @ApiProperty({ type: [PracticeSessionResponseDto] })
  declare readonly items: readonly PracticeSessionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
