import { ApiProperty } from '@core/openapi';

import { CalculationRuleStatus } from '../../model/scoring.enums';
import { RuleComponentResponseDto } from './rule-component-response.dto';

/** A calculation-rule version with its weighted components. */
export class RuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly ruleId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly teamId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly ruleKey: string;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ enum: CalculationRuleStatus })
  declare readonly status: CalculationRuleStatus;

  @ApiProperty()
  declare readonly scaleMin: number;

  @ApiProperty()
  declare readonly scaleMax: number;

  @ApiProperty()
  declare readonly minComponents: number;

  @ApiProperty({ type: [RuleComponentResponseDto] })
  declare readonly components: readonly RuleComponentResponseDto[];

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly effectiveFrom: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly effectiveTo: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly publishedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly retiredAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
