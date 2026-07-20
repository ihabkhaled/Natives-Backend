import { ApiProperty } from '@core/openapi';

import { ScoringRuleResponseDto } from './rule-response.dto';

/** A bounded page of calculation rules. */
export class ListRulesResponseDto {
  @ApiProperty({ type: [ScoringRuleResponseDto] })
  declare readonly items: readonly ScoringRuleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
