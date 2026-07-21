import { ApiProperty } from '@core/openapi';

import { RulesetStatus } from '../../model/matches.enums';

/**
 * One published version of a named scoring rule set. Every cap is nullable and a
 * null means the rule DOES NOT APPLY — it is never rendered or read as a zero.
 */
export class MatchRulesetResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly rulesetId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty()
  declare readonly rulesetKey: string;

  @ApiProperty()
  declare readonly rulesetVersion: number;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly gameTo: number;

  @ApiProperty()
  declare readonly winBy: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly hardCap: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly softCapMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly softCapPlus: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly timeCapMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly halftimeAt: number | null;

  @ApiProperty()
  declare readonly timeoutsPerTeam: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly timeoutsPerPeriod: number | null;

  @ApiProperty()
  declare readonly periods: number;

  /**
   * Whether these rules APPROVE crediting a forced opponent error to one of our
   * players. When false the statistics report that figure as `null` rather than
   * a misleading zero.
   */
  @ApiProperty()
  declare readonly opponentErrorAttribution: boolean;

  @ApiProperty({ enum: RulesetStatus })
  declare readonly status: RulesetStatus;

  @ApiProperty({ type: String, nullable: true })
  declare readonly notes: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
