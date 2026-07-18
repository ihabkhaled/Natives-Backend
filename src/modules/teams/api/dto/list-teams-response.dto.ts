import { ApiProperty } from '@core/openapi';

import { TeamResponseDto } from './team-response.dto';

export class ListTeamsResponseDto {
  @ApiProperty({ type: [TeamResponseDto] })
  declare readonly items: readonly TeamResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
