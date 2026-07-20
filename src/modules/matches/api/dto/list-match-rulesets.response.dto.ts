import { ApiProperty } from '@core/openapi';

import { MatchRulesetResponseDto } from './match-ruleset-response.dto';

/** A bounded page of published scoring rule set versions. */
export class ListMatchRulesetsResponseDto {
  @ApiProperty({ type: [MatchRulesetResponseDto] })
  declare readonly items: readonly MatchRulesetResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
