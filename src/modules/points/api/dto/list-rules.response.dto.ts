import { ApiProperty } from '@core/openapi';

import { PointsRuleResponseDto } from './rule-response.dto';

/** A bounded page of points-rule versions and candidates. */
export class ListRulesResponseDto {
  @ApiProperty({ type: [PointsRuleResponseDto] })
  declare readonly items: readonly PointsRuleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
