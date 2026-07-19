import { ApiProperty } from '@core/openapi';

/** The rule version a score was projected from. */
export class ScoreRuleReferenceResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly ruleId: string;

  @ApiProperty()
  declare readonly ruleKey: string;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty()
  declare readonly name: string;
}
