import { ApiProperty } from '@core/openapi';

import { RuleResponseDto } from './rule-response.dto';

/** A bounded page of calculation rules. */
export class ListRulesResponseDto {
  @ApiProperty({ type: [RuleResponseDto] })
  declare readonly items: readonly RuleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
