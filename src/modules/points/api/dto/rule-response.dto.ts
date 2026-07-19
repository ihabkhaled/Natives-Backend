import { ApiProperty } from '@core/openapi';

import { PointsRuleStatus } from '../../model/points.enums';
import { PointEntryResponseDto } from './point-entry-response.dto';

/** A points-rule version with its per-category value set. */
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

  @ApiProperty({ enum: PointsRuleStatus })
  declare readonly status: PointsRuleStatus;

  @ApiProperty({ type: [PointEntryResponseDto] })
  declare readonly pointEntries: readonly PointEntryResponseDto[];

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
