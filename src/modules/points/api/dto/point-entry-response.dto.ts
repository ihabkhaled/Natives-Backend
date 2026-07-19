import { ApiProperty } from '@core/openapi';

/** One activity-category point entry of a rule version. */
export class PointEntryResponseDto {
  @ApiProperty()
  declare readonly activityCategory: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly points: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly dailyCap: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly cooldownDays: number | null;
}
