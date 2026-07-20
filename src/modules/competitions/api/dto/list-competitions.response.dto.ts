import { ApiProperty } from '@core/openapi';

import { CompetitionResponseDto } from './competition-response.dto';

/** A bounded page of competitions. */
export class ListCompetitionsResponseDto {
  @ApiProperty({ type: [CompetitionResponseDto] })
  declare readonly items: readonly CompetitionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
