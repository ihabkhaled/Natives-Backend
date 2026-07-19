import { ApiProperty } from '@core/openapi';

/** A badge tier a member has earned. */
export class PlayerBadgeResponseDto {
  @ApiProperty()
  declare readonly badgeKey: string;

  @ApiProperty()
  declare readonly threshold: number;

  @ApiProperty()
  declare readonly pointsAtAward: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly awardedAt: Date;
}
